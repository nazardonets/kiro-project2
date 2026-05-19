'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validatePassword } from '@/lib/validation';

interface FieldError {
  message: string;
  constraint: string;
}

type InviteStatus = 'loading' | 'valid' | 'expired' | 'invalid' | 'already_used';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [inviteStatus, setInviteStatus] = useState<InviteStatus>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErrors, setEmailErrors] = useState<FieldError[]>([]);
  const [passwordErrors, setPasswordErrors] = useState<FieldError[]>([]);
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteStatus('invalid');
      return;
    }
    // Token is present, mark as valid for form display.
    // Full validation happens on submit via the API.
    setInviteStatus('valid');
  }, [token]);

  function validateEmail(value: string): FieldError[] {
    const errors: FieldError[] = [];
    if (!value) {
      errors.push({ message: 'Email is required', constraint: 'required' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push({ message: 'Invalid email address', constraint: 'format' });
    }
    return errors;
  }

  function validatePasswordField(value: string): FieldError[] {
    const result = validatePassword(value);
    if (!result.success) {
      return result.error.fields.password;
    }
    return [];
  }

  function handleEmailBlur() {
    setEmailErrors(validateEmail(email));
  }

  function handlePasswordBlur() {
    setPasswordErrors(validatePasswordField(password));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError('');

    const emailErrs = validateEmail(email);
    const passwordErrs = validatePasswordField(password);
    setEmailErrors(emailErrs);
    setPasswordErrors(passwordErrs);

    if (emailErrs.length > 0 || passwordErrs.length > 0) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'INVITE_EXPIRED') {
          setInviteStatus('expired');
          return;
        }
        if (data.code === 'INVITE_ALREADY_USED') {
          setInviteStatus('already_used');
          return;
        }
        if (data.code === 'INVALID_INVITE') {
          setInviteStatus('invalid');
          return;
        }
        if (data.code === 'VALIDATION_ERROR' && data.fields) {
          if (data.fields.email) {
            setEmailErrors(
              Array.isArray(data.fields.email) ? data.fields.email : [data.fields.email],
            );
          }
          if (data.fields.password) {
            setPasswordErrors(
              Array.isArray(data.fields.password) ? data.fields.password : [data.fields.password],
            );
          }
        } else if (data.code === 'EMAIL_IN_USE') {
          setEmailErrors([{ message: 'This email is already in use', constraint: 'unique' }]);
        } else {
          setGeneralError(data.message || 'Failed to accept invite. Please try again.');
        }
        return;
      }

      router.push('/partner');
    } catch {
      setGeneralError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  if (inviteStatus === 'loading') {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Validating invitation...</p>
        </CardContent>
      </Card>
    );
  }

  if (inviteStatus === 'invalid') {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Invalid Invitation</CardTitle>
          <CardDescription>
            This invitation link is not valid. Please check the link or contact your partner.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/auth/login">
            <Button variant="outline">Go to Login</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (inviteStatus === 'expired') {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Invitation Expired</CardTitle>
          <CardDescription>
            This invitation is no longer valid. Please ask your partner to generate a new invitation
            link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Invitation links expire after 72 hours for security purposes.
          </p>
          <Link href="/auth/login">
            <Button variant="outline">Go to Login</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (inviteStatus === 'already_used') {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Invitation Already Used</CardTitle>
          <CardDescription>
            This invitation has already been accepted. If you already have an account, please log
            in.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/auth/login">
            <Button variant="outline">Go to Login</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Accept Invitation</CardTitle>
        <CardDescription>
          Create your partner account to receive cycle insights and guidance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {generalError && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {generalError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailErrors.length > 0) {
                  setEmailErrors(validateEmail(e.target.value));
                }
              }}
              onBlur={handleEmailBlur}
              aria-invalid={emailErrors.length > 0}
              aria-describedby={emailErrors.length > 0 ? 'email-errors' : undefined}
              disabled={isLoading}
            />
            {emailErrors.length > 0 && (
              <div id="email-errors" className="space-y-1">
                {emailErrors.map((err) => (
                  <p key={err.constraint} className="text-sm text-destructive">
                    {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordErrors.length > 0) {
                  setPasswordErrors(validatePasswordField(e.target.value));
                }
              }}
              onBlur={handlePasswordBlur}
              aria-invalid={passwordErrors.length > 0}
              aria-describedby={passwordErrors.length > 0 ? 'password-errors' : undefined}
              disabled={isLoading}
            />
            {passwordErrors.length > 0 && (
              <div id="password-errors" className="space-y-1">
                {passwordErrors.map((err) => (
                  <p key={err.constraint} className="text-sm text-destructive">
                    {err.message}
                  </p>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              8-128 characters, at least one uppercase, one lowercase, and one digit
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create Partner Account'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-primary underline hover:no-underline">
              Log in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
