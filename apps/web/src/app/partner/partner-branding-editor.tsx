"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { getPartnerReceiptPresentation } from "@/lib/partner-receipt";

type PartnerBrandingEditorProps = {
  partners: Array<{
    id: string;
    name: string;
    membershipRole: string;
    organization: {
      support_email: string | null;
      support_phone: string | null;
      address_line1: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
      about_paragraph: string | null;
    };
    branding: {
      display_name: string | null;
      logo_url: string | null;
      primary_color: string | null;
      secondary_color: string | null;
      accent_color: string | null;
      website_url: string | null;
      receipt_footer: string | null;
    } | null;
  }>;
};

type PartnerRecord = PartnerBrandingEditorProps["partners"][number];
type PartnerBranding = NonNullable<PartnerRecord["branding"]>;

function getEmptyBranding(): PartnerBranding {
  return {
    display_name: "",
    logo_url: null,
    primary_color: "",
    secondary_color: "",
    accent_color: "",
    website_url: "",
    receipt_footer: "",
  };
}

function normalizeHexColor(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function formatRoleLabel(role: string) {
  if (role === "partner_admin") return "Organization Admin";
  if (role === "partner_coordinator") return "Coordinator";
  if (role === "partner_driver") return "Driver";
  return "Team member";
}

function ReceiptPreviewCard({
  partner,
  expanded = false,
}: {
  partner: PartnerRecord;
  expanded?: boolean;
}) {
  const preview = getPartnerReceiptPresentation({
    partnerName: partner.name,
    displayName: partner.branding?.display_name ?? null,
    logoUrl: partner.branding?.logo_url ?? null,
    primaryColor: partner.branding?.primary_color ?? null,
    secondaryColor: partner.branding?.secondary_color ?? null,
    accentColor: partner.branding?.accent_color ?? null,
    websiteUrl: partner.branding?.website_url ?? null,
    receiptFooter: partner.branding?.receipt_footer ?? null,
    supportEmail: partner.organization.support_email ?? null,
    supportPhone: partner.organization.support_phone ?? null,
  });

  return (
    <div
      className={`overflow-hidden rounded-[1.5rem] border border-black/10 ${expanded ? "mx-auto max-w-3xl" : ""}`}
      style={{ background: `linear-gradient(180deg, ${preview.secondaryColor} 0%, #ffffff 100%)` }}
    >
      <div className="border-b px-5 py-4" style={{ backgroundColor: preview.primaryColor }}>
        <div className="flex items-center gap-3">
          <div className="relative flex h-40 w-40 items-center justify-center">
            {preview.emailSafeLogoUrl ? (
              <Image src={preview.emailSafeLogoUrl} alt={`${preview.displayName} logo`} fill className="object-contain" sizes="160px" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-[1.5rem] bg-white/15 text-4xl font-bold tracking-[0.08em] text-white">
                {preview.wordmark}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Donation Receipt</p>
            <h3 className="mt-1 text-xl font-bold text-white">{preview.displayName}</h3>
            <p className="mt-1 text-sm text-white/80">Branded for your nonprofit and delivered by DonateCrate</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-5">
        <div className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: preview.accentColor }}>
            Sent from
          </p>
          <p className="mt-2 text-sm text-[var(--dc-gray-900)]">{preview.displayName} &lt;giving@donatecrate.com&gt;</p>
        </div>

        <div className="mt-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[var(--dc-gray-900)]">Subject</p>
          <p className="mt-1 text-base text-[var(--dc-gray-800)]">Your donation receipt from {preview.displayName}</p>

          <div className="mt-5 h-1.5 rounded-full" style={{ backgroundColor: preview.accentColor }} />

          <p className="mt-5 text-2xl font-bold text-[var(--dc-gray-900)]">Thank you for supporting {preview.displayName}.</p>
          <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--dc-gray-700)]">
            <p>
              We received your donated items and prepared this receipt for your records. Please keep this email for tax documentation and year-end reporting.
            </p>
            <p>
              Receipt ID: `DC-2026-04152`<br />
              Donation date: `March 25, 2026`<br />
              Donor: `Jordan Smith`
            </p>
            <p>
              This email is the receipt. Donors can keep it for their records without logging in, and valuation is completed from the donor&apos;s own item records.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4 text-sm leading-6 text-[var(--dc-gray-700)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: preview.accentColor }}>
              Receipt summary
            </p>
            <p className="mt-2">Organization: {preview.displayName}</p>
            <p>Received through: DonateCrate pickup service</p>
            <p>Donation type: Household goods and soft goods</p>
            <p>Tax-deductible value: To be determined by donor records</p>
          </div>

          <div className="mt-5 rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4 text-sm text-[var(--dc-gray-700)]">
            {preview.receiptFooter}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PartnerBrandingEditor({ partners }: PartnerBrandingEditorProps) {
  const [message, setMessage] = useState("");
  const [workingPartnerId, setWorkingPartnerId] = useState<string | null>(null);
  const [partnerState, setPartnerState] = useState(partners);
  const [previewPartnerId, setPreviewPartnerId] = useState<string | null>(null);

  async function fileToDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read logo file"));
      reader.readAsDataURL(file);
    });
  }

  async function saveSettings(partnerId: string) {
    setWorkingPartnerId(partnerId);
    setMessage("");
    try {
      const partner = partnerState.find((item) => item.id === partnerId);
      if (!partner) {
        setMessage("Could not find organization settings.");
        return;
      }
      const response = await fetch("/api/partner/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId,
          organization: {
            supportEmail: partner.organization.support_email ?? "",
            supportPhone: partner.organization.support_phone ?? "",
            addressLine1: partner.organization.address_line1 ?? "",
            city: partner.organization.city ?? "",
            state: partner.organization.state ?? "",
            postalCode: partner.organization.postal_code ?? "",
            aboutParagraph: partner.organization.about_paragraph ?? "",
          },
          branding: {
            displayName: partner.branding?.display_name ?? "",
            logoUrl: partner.branding?.logo_url ?? "",
            primaryColor: partner.branding?.primary_color ?? "",
            secondaryColor: partner.branding?.secondary_color ?? "",
            accentColor: partner.branding?.accent_color ?? "",
            websiteUrl: partner.branding?.website_url ?? "",
            receiptFooter: partner.branding?.receipt_footer ?? "",
          },
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not save organization settings");
        return;
      }
      setMessage("Organization settings saved.");
    } finally {
      setWorkingPartnerId(null);
    }
  }

  const previewPartner = useMemo(
    () => partnerState.find((partner) => partner.id === previewPartnerId) ?? null,
    [partnerState, previewPartnerId],
  );

  return (
    <div className="space-y-4">
      {partnerState.map((partner) => {
        const canEdit = partner.membershipRole === "partner_admin";

        return (
          <form
            key={partner.id}
            onSubmit={(event) => {
              event.preventDefault();
              if (!canEdit) return;
              saveSettings(partner.id);
            }}
            className="rounded-[1.85rem] border border-black/10 bg-white/90 p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dc-orange)]">Organization Settings</p>
                <h2 className="mt-2 text-2xl font-bold">{partner.name}</h2>
                <p className="text-sm text-[var(--dc-gray-700)]">Your role: {formatRoleLabel(partner.membershipRole)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${canEdit ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
                {canEdit ? "Can edit settings" : "Read only"}
              </span>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="space-y-5">
                <section className="rounded-[1.5rem] border border-black/10 bg-[var(--dc-gray-100)] p-5">
                  <h3 className="text-lg font-bold text-[var(--dc-gray-900)]">Organization details</h3>
                  <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
                    Keep your public support details current so donors know how to reach your nonprofit.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">
                      Support email
                      <input
                        value={partner.organization.support_email ?? ""}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setPartnerState((prev) =>
                            prev.map((item) =>
                              item.id !== partner.id
                                ? item
                                : {
                                    ...item,
                                    organization: {
                                      ...item.organization,
                                      support_email: event.target.value,
                                    },
                                  },
                            ),
                          )
                        }
                        placeholder="support@hopefoundation.org"
                        className="mt-1 h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-sm disabled:opacity-50"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">
                      Support phone
                      <input
                        value={partner.organization.support_phone ?? ""}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setPartnerState((prev) =>
                            prev.map((item) =>
                              item.id !== partner.id
                                ? item
                                : {
                                    ...item,
                                    organization: {
                                      ...item.organization,
                                      support_phone: event.target.value,
                                    },
                                  },
                            ),
                          )
                        }
                        placeholder="865-555-0300"
                        className="mt-1 h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-sm disabled:opacity-50"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)] md:col-span-2">
                      Mailing address
                      <input
                        value={partner.organization.address_line1 ?? ""}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setPartnerState((prev) =>
                            prev.map((item) =>
                              item.id !== partner.id
                                ? item
                                : {
                                    ...item,
                                    organization: {
                                      ...item.organization,
                                      address_line1: event.target.value,
                                    },
                                  },
                            ),
                          )
                        }
                        placeholder="123 Hope Street"
                        className="mt-1 h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-sm disabled:opacity-50"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">
                      City
                      <input
                        value={partner.organization.city ?? ""}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setPartnerState((prev) =>
                            prev.map((item) =>
                              item.id !== partner.id
                                ? item
                                : {
                                    ...item,
                                    organization: {
                                      ...item.organization,
                                      city: event.target.value,
                                    },
                                  },
                            ),
                          )
                        }
                        placeholder="Knoxville"
                        className="mt-1 h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-sm disabled:opacity-50"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">
                        State
                        <input
                          value={partner.organization.state ?? ""}
                          disabled={!canEdit}
                          onChange={(event) =>
                            setPartnerState((prev) =>
                              prev.map((item) =>
                                item.id !== partner.id
                                  ? item
                                  : {
                                      ...item,
                                      organization: {
                                        ...item.organization,
                                        state: event.target.value,
                                      },
                                    },
                              ),
                            )
                          }
                          placeholder="TN"
                          className="mt-1 h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-sm disabled:opacity-50"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">
                        ZIP code
                        <input
                          value={partner.organization.postal_code ?? ""}
                          disabled={!canEdit}
                          onChange={(event) =>
                            setPartnerState((prev) =>
                              prev.map((item) =>
                                item.id !== partner.id
                                  ? item
                                  : {
                                      ...item,
                                      organization: {
                                        ...item.organization,
                                        postal_code: event.target.value,
                                      },
                                    },
                              ),
                            )
                          }
                          placeholder="37922"
                          className="mt-1 h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-sm disabled:opacity-50"
                        />
                      </label>
                    </div>
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)] md:col-span-2">
                      About your organization
                      <textarea
                        value={partner.organization.about_paragraph ?? ""}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setPartnerState((prev) =>
                            prev.map((item) =>
                              item.id !== partner.id
                                ? item
                                : {
                                    ...item,
                                    organization: {
                                      ...item.organization,
                                      about_paragraph: event.target.value,
                                    },
                                  },
                            ),
                          )
                        }
                        rows={4}
                        placeholder="Tell supporters what your organization does and who you serve."
                        className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm disabled:opacity-50"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-black/10 bg-[var(--dc-gray-100)] p-5">
                  <h3 className="text-lg font-bold text-[var(--dc-gray-900)]">What donors see</h3>
                  <p className="mt-1 text-sm text-[var(--dc-gray-700)]">
                    These details appear on receipt emails and other donor-facing partner surfaces.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">
                      Organization name
                      <input
                        value={partner.branding?.display_name ?? ""}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setPartnerState((prev) =>
                            prev.map((item) =>
                              item.id !== partner.id
                                ? item
                                : {
                                    ...item,
                                    branding: {
                                      ...(item.branding ?? getEmptyBranding()),
                                      display_name: event.target.value,
                                    },
                                  },
                            ),
                          )
                        }
                        placeholder="Hope Foundation"
                        className="mt-1 h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-sm disabled:opacity-50"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">
                      Website
                      <input
                        value={partner.branding?.website_url ?? ""}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setPartnerState((prev) =>
                            prev.map((item) =>
                              item.id !== partner.id
                                ? item
                                : {
                                    ...item,
                                    branding: {
                                      ...(item.branding ?? getEmptyBranding()),
                                      website_url: event.target.value,
                                    },
                                  },
                            ),
                          )
                        }
                        placeholder="https://hopefoundation.org"
                        className="mt-1 h-11 w-full rounded-lg border border-black/15 bg-white px-3 text-sm disabled:opacity-50"
                      />
                    </label>
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)] md:col-span-2">
                      Logo
                      <div className="mt-1 rounded-xl border border-dashed border-black/20 bg-white p-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-[var(--dc-gray-100)]">
                            <div className="relative h-full w-full">
                              <Image
                                src={partner.branding?.logo_url || "/images/logo-provided.png"}
                                alt={`${partner.branding?.display_name || partner.name} logo`}
                                fill
                                className="object-contain"
                                sizes="64px"
                              />
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-[var(--dc-gray-800)]">Upload the logo your supporters should recognize.</p>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              disabled={!canEdit}
                              className="mt-2 block text-sm text-[var(--dc-gray-700)] disabled:opacity-50"
                              onChange={async (event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                if (file.size > 1_500_000) {
                                  setMessage("Please upload a logo smaller than 1.5 MB.");
                                  return;
                                }
                                const dataUrl = await fileToDataUrl(file);
                                setPartnerState((prev) =>
                                  prev.map((item) =>
                                    item.id !== partner.id
                                      ? item
                                      : {
                                          ...item,
                                          branding: {
                                            ...(item.branding ?? getEmptyBranding()),
                                            logo_url: dataUrl,
                                          },
                                        },
                                  ),
                                );
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </label>
                    {[
                      { key: "primary_color", label: "Primary color", fallback: "#0f766e" },
                      { key: "secondary_color", label: "Secondary color", fallback: "#f5f3ef" },
                      { key: "accent_color", label: "Accent color", fallback: "#f59e0b" },
                    ].map((field) => (
                      <label key={field.key} className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)]">
                        {field.label}
                        <div className="mt-1 flex gap-2">
                          <input
                            type="color"
                            value={normalizeHexColor(partner.branding?.[field.key as keyof PartnerBranding] as string | null | undefined, field.fallback)}
                            disabled={!canEdit}
                            onChange={(event) =>
                              setPartnerState((prev) =>
                                prev.map((item) =>
                                  item.id !== partner.id
                                    ? item
                                    : {
                                        ...item,
                                        branding: {
                                          ...(item.branding ?? getEmptyBranding()),
                                          [field.key]: event.target.value,
                                        },
                                      },
                                ),
                              )
                            }
                            className="h-11 w-14 rounded-lg border border-black/15 bg-white p-1 disabled:opacity-50"
                          />
                          <input
                            value={(partner.branding?.[field.key as keyof PartnerBranding] as string | null | undefined) ?? ""}
                            disabled={!canEdit}
                            onChange={(event) =>
                              setPartnerState((prev) =>
                                prev.map((item) =>
                                  item.id !== partner.id
                                    ? item
                                    : {
                                        ...item,
                                        branding: {
                                          ...(item.branding ?? getEmptyBranding()),
                                          [field.key]: event.target.value,
                                        },
                                      },
                                ),
                              )
                            }
                            className="h-11 flex-1 rounded-lg border border-black/15 bg-white px-3 text-sm disabled:opacity-50"
                          />
                        </div>
                      </label>
                    ))}
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--dc-gray-700)] md:col-span-2">
                      Receipt footer
                      <textarea
                        value={partner.branding?.receipt_footer ?? ""}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setPartnerState((prev) =>
                            prev.map((item) =>
                              item.id !== partner.id
                                ? item
                                : {
                                    ...item,
                                    branding: {
                                      ...(item.branding ?? getEmptyBranding()),
                                      receipt_footer: event.target.value,
                                    },
                                  },
                            ),
                          )
                        }
                        rows={4}
                        placeholder={`Thank you for supporting ${partner.branding?.display_name || partner.name} through DonateCrate.`}
                        className="mt-1 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm disabled:opacity-50"
                      />
                    </label>
                  </div>
                </section>

              </div>

              <aside className="rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dc-orange)]">Receipt Preview</p>
                  <button
                    type="button"
                    onClick={() => setPreviewPartnerId(partner.id)}
                    className="rounded-full border border-black/15 bg-white px-3 py-2 text-xs font-semibold text-[var(--dc-gray-900)]"
                  >
                    Open Preview
                  </button>
                </div>
                <div className="mt-4 scale-[0.82] origin-top-left w-[122%]">
                  <ReceiptPreviewCard partner={partner} />
                </div>
              </aside>
            </div>

            {canEdit ? (
              <button type="submit" disabled={workingPartnerId === partner.id} className="mt-4 rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60">
                {workingPartnerId === partner.id ? "Saving..." : "Save Organization Settings"}
              </button>
            ) : null}
          </form>
        );
      })}

      {previewPartner ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[1.75rem] bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--dc-orange)]">Receipt Preview</p>
                <h3 className="mt-1 text-xl font-bold text-[var(--dc-gray-900)]">{previewPartner.branding?.display_name || previewPartner.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPartnerId(null)}
                className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-[var(--dc-gray-900)]"
              >
                Close
              </button>
            </div>
            <ReceiptPreviewCard partner={previewPartner} expanded />
          </div>
        </div>
      ) : null}

      {message ? <p className="rounded-2xl border border-black/10 bg-white/85 px-4 py-3 text-sm text-[var(--dc-gray-800)] shadow-sm">{message}</p> : null}
    </div>
  );
}
