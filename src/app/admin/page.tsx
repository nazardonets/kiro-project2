'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PartnerLinkStatus, UserStatus } from '@/lib/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  email: string;
  role: string;
  status: UserStatus;
  suspension_reason: string | null;
  created_at: string;
  updated_at: string;
  partner_link: {
    status: PartnerLinkStatus;
    partner_user_id: string;
    linked_at: string;
  } | null;
}

// ─── Admin Users Page ───────────────────────────────────────────────────────

/**
 * Admin Panel - User Management page.
 *
 * Features:
 * - Search users by email or account ID (max 50 results)
 * - View account details (status, creation date, partner link)
 * - Suspend accounts with reason (1-500 chars)
 * - Delete accounts with confirmation dialog
 * - Manual link/unlink partner accounts
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Suspend dialog state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Link/Unlink dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkPartnerId, setLinkPartnerId] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Action success message
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── Search ─────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (!searchQuery.trim()) {
        setSearchError('Please enter an email address or account ID to search.');
        return;
      }

      setIsSearching(true);
      setSearchError(null);
      setSuccessMessage(null);

      try {
        const response = await fetch(
          `/api/admin/users?query=${encodeURIComponent(searchQuery.trim())}&limit=50`,
        );

        if (!response.ok) {
          const body = await response.json();
          setSearchError(body.message || 'Failed to search users.');
          setUsers([]);
          return;
        }

        const body = await response.json();
        setUsers(body.data || []);
        setHasSearched(true);
      } catch {
        setSearchError('Unable to search users. Please try again.');
        setUsers([]);
      } finally {
        setIsSearching(false);
      }
    },
    [searchQuery],
  );

  // ─── Suspend ────────────────────────────────────────────────────────────────

  const handleSuspend = useCallback(async () => {
    if (!selectedUser) return;

    if (suspendReason.length < 1 || suspendReason.length > 500) {
      setSuspendError('Suspension reason must be between 1 and 500 characters.');
      return;
    }

    setIsSuspending(true);
    setSuspendError(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: suspendReason }),
      });

      if (!response.ok) {
        const body = await response.json();
        setSuspendError(body.message || 'Failed to suspend account.');
        return;
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? { ...u, status: UserStatus.SUSPENDED, suspension_reason: suspendReason }
            : u,
        ),
      );
      setSelectedUser((prev) =>
        prev ? { ...prev, status: UserStatus.SUSPENDED, suspension_reason: suspendReason } : null,
      );
      setSuspendDialogOpen(false);
      setSuspendReason('');
      setSuccessMessage(`Account ${selectedUser.email} has been suspended.`);
    } catch {
      setSuspendError('Unable to suspend account. Please try again.');
    } finally {
      setIsSuspending(false);
    }
  }, [selectedUser, suspendReason]);

  // ─── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!selectedUser) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      });

      if (!response.ok) {
        const body = await response.json();
        setDeleteError(body.message || 'Failed to delete account.');
        return;
      }

      // Remove from local state
      setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
      setSelectedUser(null);
      setDeleteDialogOpen(false);
      setSuccessMessage(`Account ${selectedUser.email} has been deleted.`);
    } catch {
      setDeleteError('Unable to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedUser]);

  // ─── Link/Unlink ─────────────────────────────────────────────────────────────

  const handleLink = useCallback(async () => {
    if (!selectedUser || !linkPartnerId.trim()) {
      setLinkError('Please enter a valid partner user ID.');
      return;
    }

    setIsLinking(true);
    setLinkError(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_partner_id: linkPartnerId.trim() }),
      });

      if (!response.ok) {
        const body = await response.json();
        setLinkError(body.message || 'Failed to link partner account.');
        return;
      }

      const body = await response.json();
      // Update local state with the returned data
      if (body.data) {
        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? body.data : u)));
        setSelectedUser(body.data);
      }
      setLinkDialogOpen(false);
      setLinkPartnerId('');
      setSuccessMessage(`Partner account linked successfully.`);
    } catch {
      setLinkError('Unable to link partner account. Please try again.');
    } finally {
      setIsLinking(false);
    }
  }, [selectedUser, linkPartnerId]);

  const handleUnlink = useCallback(async () => {
    if (!selectedUser) return;

    setIsLinking(true);
    setLinkError(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unlink_partner: true }),
      });

      if (!response.ok) {
        const body = await response.json();
        setLinkError(body.message || 'Failed to unlink partner account.');
        return;
      }

      const body = await response.json();
      if (body.data) {
        setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? body.data : u)));
        setSelectedUser(body.data);
      } else {
        // Fallback: clear partner link locally
        setUsers((prev) =>
          prev.map((u) => (u.id === selectedUser.id ? { ...u, partner_link: null } : u)),
        );
        setSelectedUser((prev) => (prev ? { ...prev, partner_link: null } : null));
      }
      setSuccessMessage(`Partner account unlinked successfully.`);
    } catch {
      setLinkError('Unable to unlink partner account. Please try again.');
    } finally {
      setIsLinking(false);
    }
  }, [selectedUser]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">User Management</h2>

      {/* Success Message */}
      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Users</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search by email address or account ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="admin-user-search-input"
              />
            </div>
            <Button type="submit" disabled={isSearching} data-testid="admin-user-search-button">
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </form>
          {searchError && <p className="mt-2 text-sm text-destructive">{searchError}</p>}
        </CardContent>
      </Card>

      {/* Search Results */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Results ({users.length}
              {users.length === 50 ? ' — max limit reached' : ''})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found matching your query.</p>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(user);
                      setSuccessMessage(null);
                    }}
                    className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-accent ${
                      selectedUser?.id === user.id ? 'border-primary bg-accent' : ''
                    }`}
                    data-testid={`admin-user-row-${user.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.role} · {user.id}
                        </p>
                      </div>
                      <StatusBadge status={user.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Details Panel */}
      {selectedUser && (
        <Card data-testid="admin-user-details">
          <CardHeader>
            <CardTitle className="text-lg">Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailField label="Email" value={selectedUser.email} />
                <DetailField label="Account ID" value={selectedUser.id} />
                <DetailField label="Role" value={selectedUser.role} />
                <DetailField label="Status" value={<StatusBadge status={selectedUser.status} />} />
                <DetailField
                  label="Created"
                  value={new Date(selectedUser.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
                <DetailField
                  label="Last Updated"
                  value={new Date(selectedUser.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                />
              </div>

              {/* Suspension Reason */}
              {selectedUser.suspension_reason && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-800">Suspension Reason</p>
                  <p className="mt-1 text-sm text-amber-700">{selectedUser.suspension_reason}</p>
                </div>
              )}

              {/* Partner Link Status */}
              <div className="rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground">Partner Link</p>
                {selectedUser.partner_link ? (
                  <div className="mt-1 space-y-1">
                    <p className="text-sm">
                      Linked to:{' '}
                      <span className="font-mono text-xs">
                        {selectedUser.partner_link.partner_user_id}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: {selectedUser.partner_link.status} · Linked:{' '}
                      {new Date(selectedUser.partner_link.linked_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">No active partner link</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {selectedUser.role === 'primary' && (
                  <Link href={`/admin/users/${selectedUser.id}/cycles`}>
                    <Button variant="outline" size="sm" data-testid="admin-view-cycles-button">
                      View Cycles
                    </Button>
                  </Link>
                )}
                {selectedUser.status === UserStatus.ACTIVE && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSuspendDialogOpen(true);
                      setSuspendError(null);
                      setSuspendReason('');
                    }}
                    data-testid="admin-suspend-button"
                  >
                    Suspend Account
                  </Button>
                )}
                {selectedUser.status !== UserStatus.DELETED && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteDialogOpen(true);
                      setDeleteError(null);
                    }}
                    data-testid="admin-delete-button"
                  >
                    Delete Account
                  </Button>
                )}
                {selectedUser.partner_link ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnlink}
                    disabled={isLinking}
                    data-testid="admin-unlink-button"
                  >
                    {isLinking ? 'Unlinking...' : 'Unlink Partner'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLinkDialogOpen(true);
                      setLinkError(null);
                      setLinkPartnerId('');
                    }}
                    data-testid="admin-link-button"
                  >
                    Link Partner
                  </Button>
                )}
              </div>
              {linkError && <p className="text-sm text-destructive">{linkError}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Account</DialogTitle>
            <DialogDescription>
              Suspending this account will immediately revoke access. The user will be notified via
              email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="suspend-reason">
                Reason <span className="text-muted-foreground">(1-500 characters)</span>
              </Label>
              <Textarea
                id="suspend-reason"
                placeholder="Enter the reason for suspension..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                maxLength={500}
                rows={4}
                data-testid="admin-suspend-reason-input"
              />
              <p className="text-xs text-muted-foreground">{suspendReason.length}/500 characters</p>
            </div>
            {suspendError && <p className="text-sm text-destructive">{suspendError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={isSuspending || suspendReason.length < 1}
              data-testid="admin-suspend-confirm-button"
            >
              {isSuspending ? 'Suspending...' : 'Suspend Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All associated data will be deleted,
              including cycle records, personal notes, survey responses, and sharing preferences.
              {selectedUser?.partner_link && " The linked partner's access will also be revoked."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">
                You are about to permanently delete:
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedUser?.email} ({selectedUser?.id})
              </p>
            </div>
            {deleteError && <p className="mt-2 text-sm text-destructive">{deleteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              data-testid="admin-delete-confirm-button"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Partner Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Partner Account</DialogTitle>
            <DialogDescription>
              Manually link a partner user to this primary account. Enter the partner user&apos;s
              account ID.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="partner-id">Partner User ID</Label>
              <Input
                id="partner-id"
                placeholder="Enter partner account ID..."
                value={linkPartnerId}
                onChange={(e) => setLinkPartnerId(e.target.value)}
                data-testid="admin-link-partner-id-input"
              />
            </div>
            {linkError && <p className="text-sm text-destructive">{linkError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLink}
              disabled={isLinking || !linkPartnerId.trim()}
              data-testid="admin-link-confirm-button"
            >
              {isLinking ? 'Linking...' : 'Link Partner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    [UserStatus.ACTIVE]: 'bg-green-100 text-green-800 border-green-200',
    [UserStatus.SUSPENDED]: 'bg-amber-100 text-amber-800 border-amber-200',
    [UserStatus.DELETED]: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}
