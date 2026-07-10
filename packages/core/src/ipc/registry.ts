/**
 * 013 IPC Framework — Contract Registry
 * First-class. Validates ownership, versions, no reuse at registration time.
 * See 013 spec §2, §7 (Explicit Contract Registry), failure matrix.
 *
 * ponytail: in-memory map; persisted registry in future (016).
 */

import type { IpcContract, Capability as _Capability } from './contracts/index.js';
import { createIpcError, type IpcError } from './errors.js';

export interface RegisteredContract {
  contract: IpcContract;
  registeredAt: number;
}

export class ContractRegistry {
  private contracts = new Map<string, RegisteredContract>();
  private namespaceOwners = new Map<string, string>(); // ns -> ownerModule

  /** Register (idempotent for same). Fails on ownership conflict or bad name. */
  register(contract: IpcContract): void | IpcError {
    const { channel: _channel, namespace, ownerModule } = contract;

    // enforce naming
    if (!_channel.includes('@') || !/^[^:]+:[^@]+@\d+\.\d+$/.test(_channel)) {
      return createIpcError({
        code: 'CONTRACT_BAD_NAME',
        category: 'contract',
        message: `Channel must be <ns>:<op>@<major>.<minor>: ${_channel}`,
        retryable: false,
      });
    }

    const existing = this.contracts.get(_channel);
    if (existing) {
      if (existing.contract.ownerModule !== ownerModule) {
        return createIpcError({ code: 'CONTRACT_OWNERSHIP_CONFLICT', category: 'contract', message: `Namespace ${namespace} owned by ${existing.contract.ownerModule}`, retryable: false });
      }
      return; // already ok
    }

    // namespace ownership check
    const owner = this.namespaceOwners.get(namespace);
    if (owner && owner !== ownerModule) {
      return createIpcError({ code: 'NAMESPACE_OWNED', category: 'contract', message: `Namespace ${namespace} permanently owned by ${owner}`, retryable: false });
    }

    this.contracts.set(_channel, { contract, registeredAt: Date.now() });
    if (!owner) this.namespaceOwners.set(namespace, ownerModule);

    console.warn(`[module=ipc-framework] phase=contract-registered channel=${_channel} owner=${ownerModule}`);
  }

  get(channel: string): IpcContract | undefined {
    return this.contracts.get(channel)?.contract;
  }

  getAll(): RegisteredContract[] {
    return Array.from(this.contracts.values());
  }

  validateAtBoot(): void | IpcError {
    // simple: ensure no empty
    if (this.contracts.size === 0) {
      return createIpcError({ code: 'REGISTRY_EMPTY', category: 'contract', message: 'No contracts registered', retryable: false });
    }
    console.warn(`[module=ipc-framework] phase=registry-validated count=${this.contracts.size}`);
  }

  hasNamespace(ns: string): boolean {
    return this.namespaceOwners.has(ns);
  }
}

// Global singleton for boot (simple; DI in real later)
let _registry: ContractRegistry | null = null;

export function getContractRegistry(): ContractRegistry {
  if (!_registry) {
    _registry = new ContractRegistry();
    console.warn('[module=ipc-framework] phase=registry-created');
  }
  return _registry;
}
