export type SlashContext = { start: number; end: number; query: string };

export function macroSlashContext(value: string, cursor: number): SlashContext | null {
    const prefix = value.slice(0, cursor);
    const match = /(?:^|\s)\/([a-zA-Z0-9_-]*)$/.exec(prefix);
    if (!match) return null;
    const suffix = /^[a-zA-Z0-9_-]*/.exec(value.slice(cursor))?.[0] ?? '';
    return { start: cursor - match[1].length - 1, end: cursor + suffix.length, query: match[1].toLowerCase() };
}

export function filterMacroSuggestions<T extends { name: string; shortcut: string | null }>(macros: T[], query: string): T[] {
    const search = query.toLowerCase();
    return macros.filter((macro) => `${macro.shortcut ?? ''} ${macro.name}`.toLowerCase().includes(search));
}

export function insertMacroReply(value: string, context: SlashContext, message: string): { value: string; cursor: number } {
    return { value: value.slice(0, context.start) + message + value.slice(context.end), cursor: context.start + message.length };
}
