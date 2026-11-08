import type { OwnershipPolicy } from '../../../../vendor/base/egress-service/ownership';
import type { TrustedTransport } from '../../../../vendor/base/integrations';
export function nativeEgress(ownership: OwnershipPolicy): TrustedTransport;
export function figmaEgress(value: string, init: RequestInit): Promise<Response>;
