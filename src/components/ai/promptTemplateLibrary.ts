export type PromptTemplateKind = 'map' | 'event' | 'database' | 'asset' | 'balancing';

export interface PromptTemplate {
  id: string;
  kind: PromptTemplateKind;
  label: string;
  intent: string;
  body: string;
  placeholders: string[];
}

export interface PromptTemplateLibrary {
  templates: PromptTemplate[];
  version: number;
}

const TEMPLATES: PromptTemplate[] = [
  {
    id: 'map-draft-town',
    kind: 'map',
    label: 'Draft a town map',
    intent: 'map.draft.town',
    body:
      'Draft a {{size}} town map for project {{projectTitle}}. ' +
      'Place {{eventCount}} event anchors (inn, shop, NPC houses) and a small encounter ring. ' +
      'Use tile roles consistent with the existing tileset {{tilesetId}} if available. ' +
      'Return a JSON map draft only; do not apply changes yet.',
    placeholders: ['size', 'projectTitle', 'eventCount', 'tilesetId'],
  },
  {
    id: 'map-draft-dungeon',
    kind: 'map',
    label: 'Draft a dungeon map',
    intent: 'map.draft.dungeon',
    body:
      'Draft a {{size}} dungeon map for project {{projectTitle}}. ' +
      'Include {{roomCount}} rooms connected by corridors, a boss room, and {{trapCount}} traps. ' +
      'Return a JSON map draft only; do not apply changes yet.',
    placeholders: ['size', 'projectTitle', 'roomCount', 'trapCount'],
  },
  {
    id: 'event-draft-dialogue',
    kind: 'event',
    label: 'Draft dialogue for selected event',
    intent: 'event.draft.dialogue',
    body:
      'Draft dialogue for the selected event on map {{mapId}} for project {{projectTitle}}. ' +
      'The speaker is {{speakerName}} and the topic is {{topic}}. ' +
      'Keep the script under {{maxLines}} showText commands. ' +
      'Return the event commands as a JSON list; do not apply yet.',
    placeholders: ['mapId', 'projectTitle', 'speakerName', 'topic', 'maxLines'],
  },
  {
    id: 'event-draft-quest',
    kind: 'event',
    label: 'Draft a small quest event',
    intent: 'event.draft.quest',
    body:
      'Draft a quest event for project {{projectTitle}}: ' +
      'objectives {{objectiveCount}}, reward gold {{gold}}, and an end condition tied to switch {{switchId}}. ' +
      'Return the event commands as a JSON list; do not apply yet.',
    placeholders: ['projectTitle', 'objectiveCount', 'gold', 'switchId'],
  },
  {
    id: 'database-balance-actor',
    kind: 'database',
    label: 'Balance an actor',
    intent: 'database.balance.actor',
    body:
      'Suggest stat and skill adjustments for the actor named {{actorName}} in project {{projectTitle}}. ' +
      'Use the existing actor table; do not invent new rows. ' +
      'Return suggested changes as a JSON patch; do not apply yet.',
    placeholders: ['actorName', 'projectTitle'],
  },
  {
    id: 'database-repair-references',
    kind: 'database',
    label: 'Repair broken references',
    intent: 'database.repair.references',
    body:
      'Find broken references in project {{projectTitle}} tables {{tables}}. ' +
      'Propose offline-safe replacements or removals. ' +
      'Return suggested changes as a JSON patch; do not apply yet.',
    placeholders: ['projectTitle', 'tables'],
  },
  {
    id: 'asset-icon',
    kind: 'asset',
    label: 'Draft an item icon',
    intent: 'asset.draft.icon',
    body:
      'Draft a 32x32 icon for the item named {{itemName}} in project {{projectTitle}}. ' +
      'Style: project-default. ' +
      'Return the generated asset id and a visual QA verdict; do not commit to the catalog yet.',
    placeholders: ['itemName', 'projectTitle'],
  },
  {
    id: 'asset-portrait',
    kind: 'asset',
    label: 'Draft an actor portrait',
    intent: 'asset.draft.portrait',
    body:
      'Draft a portrait for actor {{actorName}} in project {{projectTitle}}. ' +
      'Style: project-default. ' +
      'Return the generated asset id and a visual QA verdict; do not commit to the catalog yet.',
    placeholders: ['actorName', 'projectTitle'],
  },
  {
    id: 'balancing-team',
    kind: 'balancing',
    label: 'Balance the whole party',
    intent: 'balancing.party',
    body:
      'Suggest balance changes for the party of {{partySize}} in project {{projectTitle}}. ' +
      'Use the actors table; do not invent new rows. ' +
      'Return a JSON patch of suggested changes; do not apply yet.',
    placeholders: ['partySize', 'projectTitle'],
  },
];

export function buildPromptTemplateLibrary(): PromptTemplateLibrary {
  return { templates: TEMPLATES, version: 1 };
}

export function renderPromptTemplate(template: PromptTemplate, values: Record<string, string>): string {
  return template.body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const v = values[key];
    if (typeof v === 'string') return v;
    return match;
  });
}
