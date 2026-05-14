"use client";

/**
 * AccountSection — "Zona de peligro" with the GDPR delete CTA.
 *
 * Visually emphasised (amber border) so it doesn't get clicked by
 * accident. The actual deletion lives behind a double confirmation
 * (DeleteAccountModal requires the user to type their email).
 */

import { useState, type JSX } from "react";
import { Button } from "@/design-system/primitives";
import type { User } from "@/domain/entities/user";
import { SettingsSection } from "./SettingsSection";
import { DeleteAccountModal } from "./DeleteAccountModal";

interface AccountSectionProps {
  user: User;
}

export function AccountSection({ user }: AccountSectionProps): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <SettingsSection
      title="Cuenta"
      description="Acciones irreversibles. Procedé con cuidado."
      bare
    >
      <div
        style={{
          border: "1px solid var(--color-amber-ink)",
          background: "var(--color-bg)",
          borderRadius: 22,
          padding: 20,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: 240 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "var(--color-text)",
            }}
          >
            Eliminar mi cuenta y todos mis datos
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "var(--color-text-mid)",
              lineHeight: 1.5,
            }}
          >
            Borramos tu perfil, documentos, sesiones, transcripciones y
            cancelamos tu suscripción. No vas a poder recuperarlo.
          </p>
        </div>
        <Button
          variant="danger"
          size="md"
          onClick={() => setConfirmOpen(true)}
        >
          Eliminar mi cuenta
        </Button>
      </div>

      <DeleteAccountModal
        open={confirmOpen}
        email={user.email}
        onClose={() => setConfirmOpen(false)}
      />
    </SettingsSection>
  );
}
