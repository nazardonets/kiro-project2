'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validatePassword } from '@/lib/validation';

interface FieldError {
  message: string;
  constraint: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErrors, setEmailErrors] = useState<FieldError[]>([]);
  const [passwordErrors, setPasswordErrors] = useState<FieldError[]>([]);
  const [generalError, setGeneralError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmationMessage, setShowConfirmationMessage] = useState(false);

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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
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
          setGeneralError(data.message || 'Registration failed. Please try again.');
        }
        return;
      }

      if (data.needsEmailConfirmation) {
        setShowConfirmationMessage(true);
        return;
      }

      router.push('/onboarding');
    } catch {
      setGeneralError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{showConfirmationMessage ? 'Check Your Email' : 'Create Account'}</CardTitle>
        <CardDescription>
          {showConfirmationMessage
            ? `We've sent a confirmation link to ${email}. Please check your inbox and click the link to activate your account.`
            : 'Sign up to start tracking and sharing your cycle insights'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showConfirmationMessage ? (
          <div className="space-y-4 text-center">
            <div className="rounded-md bg-primary/10 p-4 text-sm text-primary">
              Didn&apos;t receive the email? Check your spam folder or try registering again.
            </div>
            <p className="text-sm text-muted-foreground">
              Once confirmed, you can{' '}
              <Link href="/auth/login" className="text-primary underline hover:no-underline">
                log in here
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {generalError && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              >
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
              {isLoading ? 'Creating account...' : 'Create Account'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary underline hover:no-underline">
                Log in
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
