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

function roleColor(role: PartnerTeamMember["role"]) {
  if (role === "partner_admin") return "dc-badge-orange";
  if (role === "partner_coordinator") return "dc-badge-neutral";
  return "dc-badge-neutral";
}

function MemberInitials({ name, email }: { name: string | null; email: string }) {
  const display = name || email;
  const parts = display.split(/[\s@]+/);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : display.slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--dc-gray-100)_0%,var(--dc-gray-200)_100%)] text-xs font-bold text-[var(--dc-gray-600)]">
      {initials}
    </span>
  );
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
          <section key={partner.id} className="dc-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[var(--dc-gray-900)]">{partner.name} Team</h2>
                <p className="mt-1 text-sm text-[var(--dc-gray-500)]">
                  {canManage
                    ? "Add people, change roles, and deactivate access when needed."
                    : "Read-only visibility into your organization team."}
                </p>
              </div>
              <span className={canManage ? "dc-badge dc-badge-success" : "dc-badge dc-badge-neutral"}>
                {canManage ? "Admin access" : "Limited access"}
              </span>
            </div>

            {canManage ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  addMember(partner.id);
                }}
                className="mt-5 rounded-[var(--radius-md)] border border-black/6 bg-[var(--dc-gray-50)] p-4"
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
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
                    className="dc-input w-full"
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
                    className="dc-input w-full"
                  >
                    <option value="partner_admin">Organization Admin</option>
                    <option value="partner_coordinator">Coordinator</option>
                    <option value="partner_driver">Driver</option>
                  </select>
                  <button
                    type="submit"
                    disabled={workingKey === `add:${partner.id}`}
                    className="dc-btn-primary"
                  >
                    {workingKey === `add:${partner.id}` ? "Saving..." : "Add Member"}
                  </button>
                </div>
                <p className="mt-3 text-xs text-[var(--dc-gray-500)]">
                  Enter any email. If the person does not have a DonateCrate account, we will create one and send a branded setup email.
                </p>
              </form>
            ) : null}

            <div className="mt-5 space-y-2 dc-stagger">
              {partner.team.map((member) => {
                const memberWorking = workingKey === `member:${member.id}`;
                const canEditMember = canManage && member.editable;
                return (
                  <article key={member.id} className="dc-inner-panel">
                    <div className="flex items-start gap-3">
                      <MemberInitials name={member.full_name} email={member.email} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[var(--dc-gray-900)]">{member.full_name || member.email}</p>
                            <p className="text-xs text-[var(--dc-gray-500)]">{member.email}{member.phone ? ` \u00b7 ${member.phone}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`dc-badge ${roleColor(member.role)}`}>
                              {formatRole(member.role)}
                            </span>
                            <span className={`dc-badge ${member.active ? "dc-badge-success" : "dc-badge-neutral"}`}>
                              {member.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>

                        {canEditMember ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <select
                              value={member.role}
                              disabled={memberWorking}
                              onChange={(event) =>
                                updateMember(member.id, {
                                  role: event.target.value as PartnerTeamMember["role"],
                                })
                              }
                              className="dc-input !h-8 !text-xs !px-2"
                            >
                              <option value="partner_admin">Organization Admin</option>
                              <option value="partner_coordinator">Coordinator</option>
                              <option value="partner_driver">Driver</option>
                            </select>
                            <button
                              type="button"
                              disabled={memberWorking}
                              onClick={() => updateMember(member.id, { active: !member.active })}
                              className="dc-btn-secondary !py-1.5 !px-3 !text-xs"
                            >
                              {member.active ? "Deactivate" : "Reactivate"}
                            </button>
                            <button
                              type="button"
                              disabled={memberWorking}
                              onClick={() => deleteMember(partner.id, member.id, member.full_name || member.email)}
                              className="dc-badge dc-badge-danger cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        ) : canManage && !member.editable ? (
                          <p className="mt-2 text-xs text-[var(--dc-gray-400)]">
                            This row cannot be edited until the membership record is repaired.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
              {partner.team.length === 0 ? (
                <p className="rounded-[var(--radius-md)] border border-dashed border-black/10 bg-white/60 px-4 py-4 text-center text-sm text-[var(--dc-gray-500)]">
                  No team members assigned yet. Add your first member above.
                </p>
              ) : null}
            </div>
          </section>
        );
      })}

      {message ? (
        <div className="dc-toast dc-toast-success">
          {message}
        </div>
      ) : null}
    </div>
  );
}
