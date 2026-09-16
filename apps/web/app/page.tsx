'use client';

import { getGreetingOptions } from '@demo/api-client/query';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

export default function Home() {
  const [name, setName] = useState('Lakshya');
  const [submittedName, setSubmittedName] = useState('Lakshya');
  // Both the request and response types come from Go via OpenAPI + Hey API.
  const greeting = useQuery(getGreetingOptions({ query: { name: submittedName } }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    if (value === submittedName) void greeting.refetch();
    else setSubmittedName(value);
  }

  return (
    <main>
      <p className="eyebrow">NX / NEXT.JS / GO</p>
      <h1>
        One endpoint.
        <br />
        <span>Types all the way.</span>
      </h1>
      <p className="intro">
        Go defines the contract. OpenAPI carries it. Your frontend knows exactly what comes back.
      </p>
      <div className="pipeline">
        <span>Huma + Gin</span>
        <b>→</b>
        <span>OpenAPI</span>
        <b>→</b>
        <span>Hey API</span>
        <b>→</b>
        <span>TanStack Query</span>
      </div>
      <section>
        <div className="section-heading">
          <span>TRY THE CONNECTION</span>
          <code>GET /api/greeting</code>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="name">Your name</label>
          <div className="input-row">
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
            />
            <button disabled={greeting.isFetching}>
              Send request <span>↗</span>
            </button>
          </div>
        </form>
        <div className="response" aria-live="polite">
          {greeting.isPending ? (
            <p>Connecting to Go…</p>
          ) : greeting.isError ? (
            <p role="alert">
              Could not fetch the greeting. Make sure the Go API is running, then try again.
            </p>
          ) : (
            <>
              <p className="success">● RESPONSE RECEIVED</p>
              <h2>{greeting.data.message}</h2>
              <pre>{JSON.stringify(greeting.data, null, 2)}</pre>
              <p className="inferred">
                Inferred from Go: <code>message: string</code> · <code>name: string</code> ·{' '}
                <code>language: &quot;go&quot;</code>
              </p>
            </>
          )}
        </div>
      </section>
      <p className="footnote">
        Change a Go field, run <code>pnpm typecheck</code>, and let TypeScript show you every
        affected usage.
      </p>
    </main>
  );
}
