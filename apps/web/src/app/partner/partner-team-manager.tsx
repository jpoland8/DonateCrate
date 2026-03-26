"use client";

import { useState } from "react";

type PartnerTeamMember = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: "partner_admin" | "partner_coordinator" | "partner_driver";
  active: boolean;
  editable: boolean;
};

type PartnerTeamManagerProps = {
  partners: Array<{
    id: string;
    name: string;
    membershipRole: "partner_admin" | "partner_coordinator" | "partner_driver";
    team: PartnerTeamMember[];
  }>;
};

function formatRole(role: PartnerTeamMember["role"]) {
  if (role === "partner_admin") return "Organization Admin";
  if (role === "partner_coordinator") return "Coordinator";
  return "Driver";
}

export function PartnerTeamManager({ partners }: PartnerTeamManagerProps) {
  const [partnerState, setPartnerState] = useState(partners);
  const [drafts, setDrafts] = useState<Record<string, { userEmail: string; role: PartnerTeamMember["role"] }>>(
    Object.fromEntries(partners.map((partner) => [partner.id, { userEmail: "", role: "partner_coordinator" }])),
  );
  const [message, setMessage] = useState("");
  const [workingKey, setWorkingKey] = useState<string | null>(null);

  async function addMember(partnerId: string) {
    const draft = drafts[partnerId];
    if (!draft?.userEmail.trim()) {
      setMessage("Enter a team member email first.");
      return;
    }

    setWorkingKey(`add:${partnerId}`);
    setMessage("");
    try {
      const response = await fetch("/api/partner/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId,
          userEmail: draft.userEmail.trim().toLowerCase(),
          role: draft.role,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not add team member");
        return;
      }

      setPartnerState((prev) =>
        prev.map((partner) =>
          partner.id !== partnerId
            ? partner
            : {
                ...partner,
                team: [...partner.team.filter((member) => member.id !== json.member.id), json.member].sort((a, b) =>
                  (a.full_name || a.email).localeCompare(b.full_name || b.email),
                ),
              },
        ),
      );
      setDrafts((prev) => ({ ...prev, [partnerId]: { userEmail: "", role: "partner_coordinator" } }));
      setMessage(
        json.warning
          ? `Team member added. Setup email could not be sent: ${json.warning}`
          : json.invited
            ? "Team member added and setup email sent."
            : "Partner team member saved.",
      );
    } finally {
      setWorkingKey(null);
    }
  }

  async function updateMember(
    membershipId: string,
    changes: Partial<Pick<PartnerTeamMember, "role" | "active">>,
  ) {
    setWorkingKey(`member:${membershipId}`);
    setMessage("");
    try {
      const response = await fetch("/api/partner/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId,
          ...changes,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not update team member");
        return;
      }

      setPartnerState((prev) =>
        prev.map((partner) => ({
          ...partner,
          team: partner.team.map((member) => (member.id === membershipId ? json.member : member)),
        })),
      );
      setMessage("Partner team updated.");
    } finally {
      setWorkingKey(null);
    }
  }

  async function deleteMember(partnerId: string, membershipId: string, memberLabel: string) {
    const confirmed = window.confirm(`Delete ${memberLabel} from this organization? This removes their team access instead of only marking them inactive.`);
    if (!confirmed) return;

    setWorkingKey(`member:${membershipId}`);
    setMessage("");
    try {
      const response = await fetch("/api/partner/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.error || "Could not delete team member");
        return;
      }

      setPartnerState((prev) =>
        prev.map((partner) =>
          partner.id !== partnerId
            ? partner
            : {
                ...partner,
                team: partner.team.filter((member) => member.id !== membershipId),
              },
        ),
      );
      setMessage("Team member deleted.");
    } finally {
      setWorkingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      {partnerState.map((partner) => {
        const canManage = partner.membershipRole === "partner_admin";
        const draft = drafts[partner.id] ?? { userEmail: "", role: "partner_coordinator" as const };

        return (
          <section key={partner.id} className="rounded-[1.85rem] border border-black/10 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{partner.name} Team</h2>
                <p className="text-sm text-[var(--dc-gray-700)]">
                  {canManage
                    ? "Organization admins can add people, change roles, and deactivate access when needed."
                    : "Read-only visibility into your organization team."}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  canManage ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                }`}
              >
                {canManage ? "Organization admin access" : "Limited access"}
              </span>
            </div>

            {canManage ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  addMember(partner.id);
                }}
                className="mt-4 grid gap-3 rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4 md:grid-cols-[minmax(0,1fr)_180px_auto]"
              >
                <input
                  value={draft.userEmail}
                  onChange={(event) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [partner.id]: {
                        ...draft,
                        userEmail: event.target.value,
                      },
                    }))
                  }
                  placeholder="Work email address"
                  className="h-10 rounded-lg border border-black/15 bg-white px-3"
                />
                <select
                  value={draft.role}
                  onChange={(event) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [partner.id]: {
                        ...draft,
                        role: event.target.value as PartnerTeamMember["role"],
                      },
                    }))
                  }
                  className="h-10 rounded-lg border border-black/15 bg-white px-3"
                >
                  <option value="partner_admin">Organization Admin</option>
                  <option value="partner_coordinator">Coordinator</option>
                  <option value="partner_driver">Driver</option>
                </select>
                <button
                  type="submit"
                  disabled={workingKey === `add:${partner.id}`}
                  className="rounded-lg bg-[var(--dc-orange)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {workingKey === `add:${partner.id}` ? "Saving..." : "Add Team Member"}
                </button>
                <p className="md:col-span-3 text-xs text-[var(--dc-gray-700)]">
                  Enter any email address. If the person does not have a DonateCrate account yet, we will create it and send a branded setup email for this organization.
                </p>
              </form>
            ) : null}

            <div className="mt-4 space-y-3">
              {partner.team.map((member) => {
                const memberWorking = workingKey === `member:${member.id}`;
                const canEditMember = canManage && member.editable;
                return (
                  <article key={member.id} className="rounded-2xl border border-black/10 bg-[var(--dc-gray-100)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{member.full_name || member.email}</p>
                        <p className="text-xs text-[var(--dc-gray-700)]">{member.email}</p>
                        <p className="mt-1 text-xs text-[var(--dc-gray-700)]">{member.phone || "No phone on file"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--dc-gray-900)]">
                          {formatRole(member.role)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            member.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {member.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>

                    {canEditMember ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <select
                          value={member.role}
                          disabled={memberWorking}
                          onChange={(event) =>
                            updateMember(member.id, {
                              role: event.target.value as PartnerTeamMember["role"],
                            })
                          }
                          className="rounded-full border border-black/15 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-60"
                        >
                          <option value="partner_admin">Organization Admin</option>
                          <option value="partner_coordinator">Coordinator</option>
                          <option value="partner_driver">Driver</option>
                        </select>
                        <button
                          type="button"
                          disabled={memberWorking}
                          onClick={() => updateMember(member.id, { active: !member.active })}
                          className="rounded-full border border-black/15 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-60"
                        >
                          {member.active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button
                          type="button"
                          disabled={memberWorking}
                          onClick={() => deleteMember(partner.id, member.id, member.full_name || member.email)}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    ) : canManage && !member.editable ? (
                      <p className="mt-3 text-xs text-[var(--dc-gray-700)]">
                        This row is shown so you can see your own current access, but it cannot be edited until the membership record is repaired.
                      </p>
                    ) : null}
                  </article>
                );
              })}
              {partner.team.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-black/15 bg-white/60 px-4 py-3 text-sm text-[var(--dc-gray-700)]">
                  No organization team members assigned yet.
                </p>
              ) : null}
            </div>
          </section>
        );
      })}

      {message ? (
        <p className="rounded-2xl border border-black/10 bg-white/85 px-4 py-3 text-sm text-[var(--dc-gray-800)] shadow-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
