/**
 * CreateShareLinkUseCase — wraps `ShareApiPort.createForSession`.
 *
 * Pro+ tier-gated server-side (Pro=10/period, Premium=unlimited, Free=402).
 * The frontend gates the modal entirely behind `useTierGate("share_links")`
 * so the user never sees the form on Free tier.
 */

import type {
  CreateShareLinkRequest,
  ShareApiPort,
} from "@/application/ports/share-api.port";
import type { ShareLink } from "@/domain/entities/share-link";

export class CreateShareLinkUseCase {
  constructor(private readonly api: ShareApiPort) {}

  execute(req: CreateShareLinkRequest): Promise<ShareLink> {
    return this.api.createForSession(req);
  }
}
