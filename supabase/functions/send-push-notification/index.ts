import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const FCM_TOKEN_URI = 'https://oauth2.googleapis.com/token';

interface NotificationPayload {
  ticketId: string;
  notificationType: 'created' | 'updated' | 'assigned' | 'resolved' | 'verified' | 'closed';
}

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

const base64UrlEncode = (input: string | ArrayBuffer) => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const pemToArrayBuffer = (pem: string) => {
  const cleaned = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const importPrivateKey = async (pem: string) => {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
};

const signJwt = async (header: Record<string, unknown>, payload: Record<string, unknown>, pem: string) => {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await importPrivateKey(pem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
};

const getAccessToken = async (serviceAccount: ServiceAccount) => {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60;
  const tokenUri = serviceAccount.token_uri || FCM_TOKEN_URI;

  const jwt = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: serviceAccount.client_email,
      scope: FCM_SCOPE,
      aud: tokenUri,
      iat,
      exp,
    },
    serviceAccount.private_key
  );

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.access_token as string;
};

const isUnregisteredToken = (payload: any) => {
  const details = payload?.error?.details;
  if (!Array.isArray(details)) return false;
  return details.some(
    (detail) =>
      detail?.['@type']?.includes('google.firebase.fcm.v1.FcmError') &&
      detail?.errorCode === 'UNREGISTERED'
  );
};

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
    const fcmServiceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');

    if (!fcmServiceAccountJson) {
      console.error('FCM_SERVICE_ACCOUNT_JSON not configured');
      return new Response(JSON.stringify({ error: 'FCM not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceAccount = JSON.parse(fcmServiceAccountJson) as ServiceAccount;
    const accessToken = await getAccessToken(serviceAccount);

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

    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
    const invalidTokens: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const token of tokens) {
      const message = {
        message: {
          token: token.token,
          notification: {
            title: notificationTitle,
            body: notificationBody,
          },
          data: {
            ticketId: ticket.id,
            ticketNumber: String(ticket.ticket_number),
            type: notificationType,
          },
          android: {
            priority: 'high',
          },
          apns: {
            headers: {
              'apns-priority': '10',
            },
            payload: {
              aps: {
                sound: 'default',
              },
            },
          },
        },
      };

      const response = await fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (response.ok) {
        successCount += 1;
        continue;
      }

      failureCount += 1;
      const errorPayload = await response.json().catch(() => ({}));
      if (isUnregisteredToken(errorPayload)) {
        invalidTokens.push(token.token);
      }
      console.log('FCM v1 error:', JSON.stringify(errorPayload));
    }

    if (invalidTokens.length > 0) {
      console.log('Removing invalid tokens:', invalidTokens.length);
      await supabase
        .from('push_tokens')
        .delete()
        .in('token', invalidTokens);
    }

    return new Response(JSON.stringify({
      sent: tokens.length,
      success: successCount,
      failure: failureCount,
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
