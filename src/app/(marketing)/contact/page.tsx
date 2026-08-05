import type { Metadata } from "next";
import { Mail, MapPin, Send } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Sales & Support | GSTPilot",
  description:
    "Get in touch with GSTPilot team for sales inquiries, CA firm bulk accounts, or technical support.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-16">
      <div className="space-y-4 text-center">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold tracking-wider text-primary-ink uppercase">
          Contact Us
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">We're Here to Help</h1>
        <p className="text-sm text-muted-foreground">
          Have questions about e-commerce GST filing or custom ERP mappings? Contact our team.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-bold">Send Us a Message</h2>
          <form className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-muted-foreground">Your Name</label>
              <input
                type="text"
                placeholder="John Doe"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2"
              />
            </div>
            <div>
              <label className="font-semibold text-muted-foreground">Email Address</label>
              <input
                type="email"
                placeholder="john@example.com"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2"
              />
            </div>
            <div>
              <label className="font-semibold text-muted-foreground">Message</label>
              <textarea
                rows={4}
                placeholder="How can we help?"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2"
              />
            </div>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              <Send className="size-3.5" /> Send Message
            </button>
          </form>
        </div>

        <div className="flex flex-col justify-between space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div>
            <h2 className="mb-4 text-base font-bold">Contact Information</h2>
            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <Mail className="size-4 text-primary-ink" />
                <span>support@gstpilot.in</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="size-4 text-primary-ink" />
                <span>GSTPilot HQ, Tech Hub, Mumbai, Maharashtra 400001</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
