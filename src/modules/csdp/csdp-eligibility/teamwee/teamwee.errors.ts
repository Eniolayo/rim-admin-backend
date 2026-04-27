export class TeamweeUnavailableError extends Error {
  constructor(
    public readonly cause: 'timeout' | 'circuit_open' | 'http_5xx' | 'malformed' | 'connection',
    message?: string,
  ) {
    super(message ?? `Teamwee unavailable: ${cause}`);
    this.name = 'TeamweeUnavailableError';
  }
}
