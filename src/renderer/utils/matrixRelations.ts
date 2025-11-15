import { nanoid } from 'nanoid';

import type { TraceabilityRelation, TraceRelationKind } from '@/shared/traceability';

const makeKey = (leftId: string, rightId: string): string => `${leftId}::${rightId}`;

export const buildRelationLookup = (relations: TraceabilityRelation[]): Map<string, TraceabilityRelation> => {
  const map = new Map<string, TraceabilityRelation>();
  relations.forEach((relation) => {
    relation.left_ids.forEach((leftId) => {
      relation.right_ids.forEach((rightId) => {
        map.set(makeKey(leftId, rightId), relation);
      });
    });
  });
  return map;
};

export const toggleTraceRelation = (
  relations: TraceabilityRelation[],
  leftId: string,
  rightId: string,
): { next: TraceabilityRelation[]; isActive: boolean } => {
  const lookup = buildRelationLookup(relations);
  const key = makeKey(leftId, rightId);
  const existing = lookup.get(key);
  if (!existing) {
    const relation: TraceabilityRelation = {
      id: nanoid(),
      left_ids: [leftId],
      right_ids: [rightId],
      type: 'trace',
      directed: 'left_to_right',
    };
    return { next: [...relations, relation], isActive: true };
  }

  const updatedRelations = relations
    .map((relation) => {
      if (relation.id !== existing.id) {
        return relation;
      }
      const leftIds = relation.left_ids.filter((id) => id !== leftId);
      const rightIds = relation.right_ids.filter((id) => id !== rightId);
      if (leftIds.length === 0 || rightIds.length === 0) {
        return null;
      }
      return { ...relation, left_ids: leftIds, right_ids: rightIds } satisfies TraceabilityRelation;
    })
    .filter((relation): relation is TraceabilityRelation => relation !== null);

  return { next: updatedRelations, isActive: false };
};

export const changeRelationKind = (
  relations: TraceabilityRelation[],
  leftId: string,
  rightId: string,
  kind: TraceRelationKind,
): TraceabilityRelation[] => {
  const lookup = buildRelationLookup(relations);
  const key = makeKey(leftId, rightId);
  const existing = lookup.get(key);
  if (!existing) {
    return relations;
  }
  return relations.map((relation) =>
    relation.id === existing.id ? { ...relation, type: kind } : relation,
  );
};
