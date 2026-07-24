"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Settings, Shield, Share2, Users, Clock,
  Palette, FileText, AlertTriangle, X, Plus, Save, Upload, Trash2,
} from "lucide-react";
import { getSettings, updateSettings } from "@/lib/firestore";
import { uploadToDrive } from "@/lib/drive";
import { useStore } from "@/store/useStore";
import { AppSettings } from "@/types";
import { PageLoader } from "@/components/LoadingSpinner";
import toast from "react-hot-toast";

const defaultSettings: AppSettings = {
  moderationKeywords: [],
  requireApprovalFor: "website_users_only",
  allowComments: true,
  allowSharing: true,
  allowNewSignups: true,
  requireEmailVerification: false,
  autoApproveAdminPosts: true,
  siteTitle: "The Net Chronicle",
  siteDescription: "Share and discuss educational content",
  logoUrl: "",
  primaryColor: "#3b82f6",
  secondaryColor: "#f97316",
  termsOfService: "",
  privacyPolicy: "",
  communityGuidelines: "",
  enableRateLimiting: true,
  maxPostsPerDay: 10,
  maxCommentsPerDay: 50,
  updatedAt: { toDate: () => new Date() } as any,
  updatedBy: "",
};

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-dark-primary">{label}</p>
        {description && <p className="text-xs text-gray-400 dark:text-dark-tertiary mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? "bg-brand-500" : "bg-gray-200 dark:bg-dark-border"}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function Section({ title, icon: Icon, delay = 0, children }: {
  title: string;
  icon: React.ElementType;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-6"
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
          <Icon size={16} className="text-brand-500" />
        </div>
        <h2 className="text-base font-bold text-gray-900 dark:text-dark-primary">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </motion.section>
  );
}

export default function SettingsPage() {
  const { user, accessToken, setSettings: setStoreSettings } = useStore();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        if (s) setSettings(s);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (patch: Partial<AppSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!accessToken) {
      toast.error("Google Drive not connected. Sign out and sign in again.");
      return;
    }
    setUploadingLogo(true);
    try {
      const url = await uploadToDrive(file, accessToken);
      update({ logoUrl: url });
      toast.success("Logo uploaded to your Google Drive!");
    } catch {
      toast.error("Logo upload failed");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw || settings.moderationKeywords.includes(kw)) return;
    update({ moderationKeywords: [...settings.moderationKeywords, kw] });
    setNewKeyword("");
  };

  const removeKeyword = (kw: string) =>
    update({ moderationKeywords: settings.moderationKeywords.filter((k) => k !== kw) });

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateSettings(settings, user.uid);
      setStoreSettings(settings);
      if (settings.siteTitle) document.title = settings.siteTitle;
      toast.success("Settings saved and applied!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <main className="p-6 bg-gray-50 dark:bg-dark-bg min-h-screen">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings size={26} className="text-brand-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-primary">Site Settings</h1>
              <p className="text-sm text-gray-500 dark:text-dark-tertiary mt-0.5">Configure website behaviour — changes apply live across all pages</p>
            </div>
          </div>
          <motion.button
            onClick={handleSave}
            disabled={saving}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Save size={15} />
            {saving ? "Saving…" : "Save Settings"}
          </motion.button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-5">

          {/* Branding */}
          <Section title="Branding" icon={Palette} delay={0}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-dark-tertiary mb-1">Site Title</label>
                <input
                  type="text"
                  value={settings.siteTitle}
                  onChange={(e) => update({ siteTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-transparent text-gray-800 dark:text-dark-primary"
                />
              </div>

              {/* Logo upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-dark-tertiary mb-1">Site Logo</label>
                <div className="flex items-center gap-3">
                  {/* Preview */}
                  <div className="w-10 h-10 rounded-lg border border-gray-200 dark:border-dark-border flex items-center justify-center bg-gray-50 dark:bg-dark-bg flex-shrink-0 overflow-hidden">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-gray-300 dark:text-dark-tertiary text-xs">None</span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-1">
                    <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      uploadingLogo
                        ? "bg-gray-100 dark:bg-dark-border text-gray-400 cursor-not-allowed"
                        : "bg-brand-500 hover:bg-brand-600 text-white"
                    }`}>
                      {uploadingLogo ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                          <Upload size={12} />
                        </motion.div>
                      ) : (
                        <Upload size={12} />
                      )}
                      {uploadingLogo ? "Uploading…" : "Upload"}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={handleLogoUpload} />
                    </label>
                    {settings.logoUrl && (
                      <button
                        type="button"
                        onClick={() => update({ logoUrl: "" })}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Remove logo"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                {!accessToken && (
                  <p className="text-[11px] text-amber-500 mt-1">⚠ Connect Google Drive to enable logo upload</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-dark-tertiary mb-1">Site Description</label>
              <textarea
                value={settings.siteDescription}
                onChange={(e) => update({ siteDescription: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-transparent text-gray-800 dark:text-dark-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-dark-tertiary mb-1">
                Brand / Primary Color
              </label>
              <p className="text-[11px] text-gray-400 dark:text-dark-tertiary mb-2">
                Applied to buttons, links, badges, focus rings — everywhere across the site.
              </p>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={settings.primaryColor}
                  onChange={(e) => update({ primaryColor: e.target.value })}
                  className="h-10 w-14 rounded-lg border border-gray-200 dark:border-dark-border cursor-pointer"
                />
                <span className="text-sm font-mono text-gray-600 dark:text-dark-secondary">{settings.primaryColor}</span>
                <button
                  type="button"
                  onClick={() => update({ primaryColor: "#3b82f6" })}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-dark-secondary underline"
                >
                  Reset default
                </button>
              </div>
            </div>
          </Section>

          {/* Moderation */}
          <Section title="Moderation" icon={Shield} delay={0.05}>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-dark-tertiary mb-1">Require Approval For</label>
              <select
                value={settings.requireApprovalFor}
                onChange={(e) => update({ requireApprovalFor: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-dark-card text-gray-800 dark:text-dark-primary"
              >
                <option value="all">All posts (everyone needs approval)</option>
                <option value="website_users_only">Website users only (admins/staff auto-approved)</option>
                <option value="none">No posts — all auto-approved</option>
              </select>
            </div>
            <Toggle
              checked={settings.autoApproveAdminPosts}
              onChange={(v) => update({ autoApproveAdminPosts: v })}
              label="Auto-approve admin posts"
              description="Admin and superAdmin posts skip the review queue"
            />
            <Toggle
              checked={settings.allowComments}
              onChange={(v) => update({ allowComments: v })}
              label="Allow comments"
              description="When off, comment sections are hidden site-wide"
            />
            <Toggle
              checked={settings.allowSharing}
              onChange={(v) => update({ allowSharing: v })}
              label="Allow sharing"
              description="When off, share buttons are hidden on all posts"
            />
          </Section>

          {/* Banned words */}
          <Section title="Moderation Keywords" icon={AlertTriangle} delay={0.1}>
            <p className="text-xs text-gray-500 dark:text-dark-tertiary -mt-2">Posts containing these words will be blocked before submission.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                placeholder="Add a keyword…"
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-transparent text-gray-800 dark:text-dark-primary placeholder:text-gray-400"
              />
              <button type="button" onClick={addKeyword} className="flex items-center gap-1 px-3 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
                <Plus size={14} /> Add
              </button>
            </div>
            {settings.moderationKeywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {settings.moderationKeywords.map((kw) => (
                  <span key={kw} className="flex items-center gap-1 px-2.5 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium rounded-full border border-red-100 dark:border-red-700/30">
                    {kw}
                    <button type="button" onClick={() => removeKeyword(kw)} className="hover:text-red-800 dark:hover:text-red-200">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-dark-tertiary italic">No banned keywords yet</p>
            )}
          </Section>

          {/* Users & Sign-up */}
          <Section title="Users & Registration" icon={Users} delay={0.15}>
            <Toggle
              checked={settings.allowNewSignups}
              onChange={(v) => update({ allowNewSignups: v })}
              label="Allow new sign-ups"
              description="When off, existing users can still sign in but new accounts are blocked"
            />
          </Section>

          {/* Rate limiting */}
          <Section title="Rate Limiting" icon={Clock} delay={0.2}>
            <Toggle
              checked={settings.enableRateLimiting}
              onChange={(v) => update({ enableRateLimiting: v })}
              label="Enable rate limiting"
              description="Limit how many posts/comments a user can create per day"
            />
            {settings.enableRateLimiting && (
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-dark-tertiary mb-1">Max posts / day</label>
                  <input
                    type="number" min="1" max="100"
                    value={settings.maxPostsPerDay}
                    onChange={(e) => update({ maxPostsPerDay: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-transparent text-gray-800 dark:text-dark-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-dark-tertiary mb-1">Max comments / day</label>
                  <input
                    type="number" min="1" max="500"
                    value={settings.maxCommentsPerDay}
                    onChange={(e) => update({ maxCommentsPerDay: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-transparent text-gray-800 dark:text-dark-primary"
                  />
                </div>
              </div>
            )}
          </Section>

          {/* Policies */}
          <Section title="Policies & Guidelines" icon={FileText} delay={0.25}>
            <p className="text-xs text-gray-500 dark:text-dark-tertiary -mt-2">These are shown to users on the relevant policy pages.</p>
            {[
              { key: "termsOfService",       label: "Terms of Service"       },
              { key: "privacyPolicy",         label: "Privacy Policy"         },
              { key: "communityGuidelines",   label: "Community Guidelines"   },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 dark:text-dark-tertiary mb-1">{label}</label>
                <textarea
                  value={(settings as any)[key]}
                  onChange={(e) => update({ [key]: e.target.value } as any)}
                  rows={5}
                  placeholder={`Enter ${label}…`}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-transparent text-gray-800 dark:text-dark-primary resize-y placeholder:text-gray-400"
                />
              </div>
            ))}
          </Section>

          {/* Floating save button at bottom */}
          <div className="flex justify-end pt-2 pb-8">
            <motion.button
              type="submit"
              disabled={saving}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg"
            >
              <Save size={15} />
              {saving ? "Saving…" : "Save All Settings"}
            </motion.button>
          </div>
        </form>
      </div>
    </main>
  );
}
