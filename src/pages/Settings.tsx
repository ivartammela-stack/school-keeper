import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings as SettingsIcon, Mail, Bell, Flag, Link2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { logSettingChanged } from '@/lib/audit';
import { logEvent, AnalyticsEvents } from '@/lib/analytics';
import {
  getRemoteConfigBoolean,
  getRemoteConfigNumber,
  RemoteConfigKeys,
} from '@/lib/remote-config';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  getSystemSettings,
  updateSystemSetting,
  getTicketEmailSetting,
  updateTicketEmailSetting,
  getEmailTemplates,
  updateEmailTemplate as updateEmailTemplateRecord,
} from '@/lib/firestore';
import { APP_ROLES, AppRole } from '@/lib/firebase-types';

interface SystemSetting {
  id: string;
  key: string;
  value: any;
  description: string | null;
  category: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  category: string;
  enabled: boolean;
}

const roleLabels: Record<string, string> = {
  teacher: 'Õpetaja',
  safety_officer: 'Töökeskkonnavolinik',
  director: 'Direktor',
  worker: 'Töömees',
  facility_manager: 'Majandusjuhataja',
  admin: 'Admin',
};

export default function Settings() {
  const { schoolId } = useAuth();
  const { isSupported, requestPermission, token } = usePushNotifications();
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketEmailEnabled, setTicketEmailEnabled] = useState(true);
  const [ticketEmailRoles, setTicketEmailRoles] = useState<AppRole[]>(['admin']);

  useEffect(() => {
    if (schoolId) {
      fetchSettings();
      fetchEmailTemplates();
      fetchTicketEmailSetting();
    }
  }, [schoolId]);

  const fetchSettings = async () => {
    try {
      if (!schoolId) return;
      const data = await getSystemSettings(schoolId);
      const sorted = [...data].sort((a, b) => {
        const categoryCompare = a.category.localeCompare(b.category);
        if (categoryCompare !== 0) return categoryCompare;
        return a.key.localeCompare(b.key);
      });
      setSettings(sorted as SystemSetting[]);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Viga sätete laadimisel');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailTemplates = async () => {
    try {
      if (!schoolId) return;
      const data = await getEmailTemplates(schoolId);
      setEmailTemplates(data as EmailTemplate[]);
    } catch (error) {
      console.error('Error fetching email templates:', error);
      toast.error('Viga e-posti mallide laadimisel');
    }
  };

  const fetchTicketEmailSetting = async () => {
    try {
      if (!schoolId) return;
      const data = await getTicketEmailSetting(schoolId);
      if (data) {
        setTicketEmailEnabled(data.enabled);
        setTicketEmailRoles(data.roles);
      }
    } catch (error) {
      console.error('Error fetching ticket email setting:', error);
      toast.error('Viga e-posti sätete laadimisel');
    }
  };

  const updateSetting = async (key: string, newValue: any) => {
    const setting = settings.find((s) => s.key === key);
    if (!setting) return;

    try {
      if (!schoolId) return;
      await updateSystemSetting(schoolId, key, newValue);

      await logSettingChanged(key, setting.value, newValue);
      await logEvent(AnalyticsEvents.SETTINGS_CHANGED, { setting_key: key });

      toast.success('Säte uuendatud');
      fetchSettings();
    } catch (error) {
      console.error('Error updating setting:', error);
      toast.error('Viga sätte uuendamisel');
    }
  };

  const updateEmailTemplate = async (template: EmailTemplate) => {
    try {
      if (!schoolId) return;
      await updateEmailTemplateRecord(schoolId, template.id, {
        subject: template.subject,
        body: template.body,
        enabled: template.enabled,
      });

      toast.success('E-posti mall uuendatud');
      fetchEmailTemplates();
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error updating email template:', error);
      toast.error('Viga e-posti malli uuendamisel');
    }
  };

  const saveTicketEmailSetting = async () => {
    if (!schoolId) return;
    try {
      await updateTicketEmailSetting(schoolId, {
        enabled: ticketEmailEnabled,
        roles: ticketEmailRoles,
      });
      toast.success('E-posti teavitused salvestatud');
    } catch (error) {
      console.error('Error updating ticket email setting:', error);
      toast.error('Viga e-posti sätete salvestamisel');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Süsteemi Seaded</h1>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">Üldised</TabsTrigger>
          <TabsTrigger value="email">E-posti mallid</TabsTrigger>
          <TabsTrigger value="notifications">Teavitused</TabsTrigger>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
          <TabsTrigger value="integrations">Integratsioonid</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Üldised Seaded</CardTitle>
              <CardDescription>
                Süsteemi põhiseaded ja konfiguratsioon
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings
                .filter((s) => s.category === 'general' || s.category === 'maintenance')
                .map((setting) => (
                  <div key={setting.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">{setting.key}</Label>
                        {setting.description && (
                          <p className="text-sm text-muted-foreground">
                            {setting.description}
                          </p>
                        )}
                      </div>
                      {typeof setting.value === 'object' &&
                      'enabled' in setting.value ? (
                        <Switch
                          checked={setting.value.enabled}
                          onCheckedChange={(checked) =>
                            updateSetting(setting.key, {
                              ...setting.value,
                              enabled: checked,
                            })
                          }
                        />
                      ) : null}
                    </div>
                    {setting.value?.days !== undefined && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={setting.value.days}
                          onChange={(e) =>
                            updateSetting(setting.key, {
                              ...setting.value,
                              days: parseInt(e.target.value),
                            })
                          }
                          className="w-24"
                        />
                        <span className="text-sm">päeva</span>
                      </div>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Templates */}
        <TabsContent value="email" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Template List */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  <CardTitle>E-posti Mallid</CardTitle>
                </div>
                <CardDescription>Vali mall muutmiseks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {emailTemplates.map((template) => (
                  <Button
                    key={template.id}
                    variant={
                      selectedTemplate?.id === template.id ? 'default' : 'outline'
                    }
                    className="w-full justify-start"
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{template.name}</span>
                      {!template.enabled && (
                        <Badge variant="secondary">Keelatud</Badge>
                      )}
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Template Editor */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedTemplate ? 'Muuda malli' : 'Vali mall'}
                </CardTitle>
                {selectedTemplate && (
                  <CardDescription>
                    Saadaval muutujad: {selectedTemplate.variables.join(', ')}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {selectedTemplate ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Teema</Label>
                      <Input
                        id="subject"
                        value={selectedTemplate.subject}
                        onChange={(e) =>
                          setSelectedTemplate({
                            ...selectedTemplate,
                            subject: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="body">Sisu</Label>
                      <Textarea
                        id="body"
                        value={selectedTemplate.body}
                        onChange={(e) =>
                          setSelectedTemplate({
                            ...selectedTemplate,
                            body: e.target.value,
                          })
                        }
                        rows={10}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="enabled"
                          checked={selectedTemplate.enabled}
                          onCheckedChange={(checked) =>
                            setSelectedTemplate({
                              ...selectedTemplate,
                              enabled: checked,
                            })
                          }
                        />
                        <Label htmlFor="enabled">Lubatud</Label>
                      </div>
                      <Button onClick={() => updateEmailTemplate(selectedTemplate)}>
                        <Save className="h-4 w-4 mr-2" />
                        Salvesta
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Vali mall vasakult menüüst
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <CardTitle>Uue teate push-teavitused</CardTitle>
              </div>
              <CardDescription>
                Saada uus teade push-teavitusena valitud rollidele
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="text-muted-foreground">Push tugi</span>
                <span>{isSupported ? 'toetatud' : 'pole toetatud'}</span>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-base">Push-teavitused</Label>
                <Switch
                  checked={ticketEmailEnabled}
                  onCheckedChange={(checked) => setTicketEmailEnabled(checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-base">Luba teavitused seadmes</Label>
                <Button
                  variant="outline"
                  onClick={() => requestPermission()}
                  disabled={!isSupported}
                >
                  Luba push
                </Button>
              </div>
              {token && (
                <div className="text-xs text-muted-foreground">
                  Push token salvestatud.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {APP_ROLES.map((role) => {
                  const checked = ticketEmailRoles.includes(role);
                  return (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          const isChecked = Boolean(value);
                          setTicketEmailRoles((prev) =>
                            isChecked ? [...prev, role] : prev.filter((r) => r !== role)
                          );
                        }}
                        disabled={!ticketEmailEnabled}
                      />
                      {roleLabels[role] || role}
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button onClick={saveTicketEmailSetting}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvesta
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <CardTitle>Teavituste Seaded</CardTitle>
              </div>
              <CardDescription>
                Konfigureeri, millised teavitused on lubatud
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings
                .filter((s) => s.category === 'notification')
                .map((setting) => (
                  <div key={setting.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">{setting.key}</Label>
                        {setting.description && (
                          <p className="text-sm text-muted-foreground">
                            {setting.description}
                          </p>
                        )}
                      </div>
                      {typeof setting.value === 'object' &&
                      'enabled' in setting.value ? (
                        <Switch
                          checked={setting.value.enabled}
                          onCheckedChange={(checked) =>
                            updateSetting(setting.key, {
                              ...setting.value,
                              enabled: checked,
                            })
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Flags */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                <CardTitle>Feature Flags (Firebase Remote Config)</CardTitle>
              </div>
              <CardDescription>
                Read-only vaade Firebase Remote Config väärtustest
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Maintenance Mode</p>
                    <p className="text-sm text-muted-foreground">
                      {RemoteConfigKeys.MAINTENANCE_MODE}
                    </p>
                  </div>
                  <Badge
                    variant={
                      getRemoteConfigBoolean(RemoteConfigKeys.MAINTENANCE_MODE)
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {getRemoteConfigBoolean(RemoteConfigKeys.MAINTENANCE_MODE)
                      ? 'Enabled'
                      : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Reports Feature</p>
                    <p className="text-sm text-muted-foreground">
                      {RemoteConfigKeys.FEATURE_REPORTS}
                    </p>
                  </div>
                  <Badge
                    variant={
                      getRemoteConfigBoolean(RemoteConfigKeys.FEATURE_REPORTS)
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {getRemoteConfigBoolean(RemoteConfigKeys.FEATURE_REPORTS)
                      ? 'Enabled'
                      : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Audit Log Feature</p>
                    <p className="text-sm text-muted-foreground">
                      {RemoteConfigKeys.FEATURE_AUDIT_LOG}
                    </p>
                  </div>
                  <Badge
                    variant={
                      getRemoteConfigBoolean(RemoteConfigKeys.FEATURE_AUDIT_LOG)
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {getRemoteConfigBoolean(RemoteConfigKeys.FEATURE_AUDIT_LOG)
                      ? 'Enabled'
                      : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Auto Close Days</p>
                    <p className="text-sm text-muted-foreground">
                      {RemoteConfigKeys.AUTO_CLOSE_DAYS}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {getRemoteConfigNumber(RemoteConfigKeys.AUTO_CLOSE_DAYS)} days
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                💡 Feature flag'e hallatakse Firebase Console's. Need väärtused on
                read-only.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                <CardTitle>Integratsioonid</CardTitle>
              </div>
              <CardDescription>
                Väliste teenuste integratsioonid (tulevikus)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Pole veel integratsioone</p>
                <p className="text-sm mt-2">
                  Tulevikus: Slack, MS Teams, Jira integratsioonid
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
