import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  ticketId: string;
  notificationType: 'created' | 'updated' | 'assigned' | 'resolved' | 'verified' | 'closed';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId, notificationType }: NotificationPayload = await req.json();
    
    console.log(`Processing push notification for ticket ${ticketId}, type: ${notificationType}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');

    if (!fcmServerKey) {
      console.error('FCM_SERVER_KEY not configured');
      return new Response(JSON.stringify({ error: 'FCM not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch ticket with category info
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        id,
        ticket_number,
        location,
        description,
        is_safety_related,
        status,
        category:categories(id, name, name_en),
        problem_type:problem_types(id, name, code)
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('Ticket not found:', ticketError);
      return new Response(JSON.stringify({ error: 'Ticket not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Ticket found:', ticket.ticket_number, 'Safety:', ticket.is_safety_related);

    // Determine target roles based on ticket type
    let targetRoles: string[] = ['admin', 'maintenance'];
    
    if (ticket.is_safety_related) {
      targetRoles.push('safety_officer');
      console.log('Adding safety_officer to targets (safety related ticket)');
    }

    // Check if category is supplies/tools - only admin
    const categoryName = (ticket.category as any)?.name || '';
    if (categoryName.toLowerCase().includes('tarviku') || categoryName.toLowerCase().includes('töövahend')) {
      targetRoles = ['admin'];
      console.log('Supplies category - only admin');
    }

    console.log('Target roles:', targetRoles);

    // Find users with these roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', targetRoles);

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = [...new Set(userRoles?.map(r => r.user_id) || [])];
    console.log('Target user count:', userIds.length);

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No target users found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch push tokens for these users
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token, platform, user_id')
      .in('user_id', userIds);

    if (tokensError) {
      console.error('Error fetching push tokens:', tokensError);
      return new Response(JSON.stringify({ error: 'Failed to fetch tokens' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!tokens || tokens.length === 0) {
      console.log('No push tokens found for target users');
      return new Response(JSON.stringify({ sent: 0, message: 'No push tokens found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found push tokens:', tokens.length);

    // Build notification content
    const titles: Record<string, string> = {
      created: 'Uus pilet',
      updated: 'Pilet uuendatud',
      assigned: 'Pilet määratud',
      resolved: 'Pilet lahendatud',
      verified: 'Pilet kinnitatud',
      closed: 'Pilet suletud',
    };

    const problemTypeName = (ticket.problem_type as any)?.name || '';
    const notificationTitle = titles[notificationType] || 'Teavitus';
    const notificationBody = `#${ticket.ticket_number}: ${problemTypeName} - ${ticket.location}`;

    // Send via FCM (Legacy HTTP API)
    const fcmPayload = {
      registration_ids: tokens.map(t => t.token),
      notification: {
        title: notificationTitle,
        body: notificationBody,
        sound: 'default',
      },
      data: {
        ticketId: ticket.id,
        ticketNumber: String(ticket.ticket_number),
        type: notificationType,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      priority: 'high',
    };

    console.log('Sending FCM notification to', tokens.length, 'devices');

    const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${fcmServerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fcmPayload),
    });

    const fcmResult = await fcmResponse.json();
    console.log('FCM response:', JSON.stringify(fcmResult));

    // Handle failed tokens (remove invalid ones)
    if (fcmResult.results) {
      const invalidTokens: string[] = [];
      fcmResult.results.forEach((result: any, index: number) => {
        if (result.error === 'NotRegistered' || result.error === 'InvalidRegistration') {
          invalidTokens.push(tokens[index].token);
        }
      });

      if (invalidTokens.length > 0) {
        console.log('Removing invalid tokens:', invalidTokens.length);
        await supabase
          .from('push_tokens')
          .delete()
          .in('token', invalidTokens);
      }
    }

    return new Response(JSON.stringify({
      sent: tokens.length,
      success: fcmResult.success || 0,
      failure: fcmResult.failure || 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
