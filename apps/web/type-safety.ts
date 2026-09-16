// Compile-only examples. pnpm typecheck fails if these errors stop being caught.
import type { Greeting } from '@demo/api-client';
import { getGreetingOptions } from '@demo/api-client/query';

export function verifyGeneratedContract(response: Greeting) {
  getGreetingOptions({ query: { name: 'Ada' } });
  // @ts-expect-error Go's name parameter is a string, not a number.
  getGreetingOptions({ query: { name: 42 } });
  // @ts-expect-error This property does not exist in the Go response.
  void response.nonexistent;
  // @ts-expect-error The Go schema restricts language to the literal "go".
  const language: Greeting['language'] = 'typescript';
  return language;
}
