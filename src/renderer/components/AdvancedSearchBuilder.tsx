import { nanoid } from 'nanoid';
import type { FC } from 'react';
import type { SearchField, SearchOperator } from '../utils/search';

export type ConditionRow = {
  id: string;
  field: SearchField;
  operator: SearchOperator;
  value: string;
};

export interface AdvancedSearchBuilderProps {
  conditions: ConditionRow[];
  combinator: 'AND' | 'OR';
  traceDepth: number;
  onConditionsChange: (rows: ConditionRow[]) => void;
  onCombinatorChange: (value: 'AND' | 'OR') => void;
  onTraceDepthChange: (depth: number) => void;
}

const FIELD_OPTIONS: SearchField[] = ['title', 'body', 'cardId', 'status', 'kind'];
const OPERATOR_OPTIONS: SearchOperator[] = ['contains', 'equals', 'regex'];

export const AdvancedSearchBuilder: FC<AdvancedSearchBuilderProps> = ({
  conditions,
  combinator,
  traceDepth,
  onConditionsChange,
  onCombinatorChange,
  onTraceDepthChange,
}) => {
  const handleAdd = () => {
    onConditionsChange([
      ...conditions,
      {
        id: nanoid(),
        field: 'title',
        operator: 'contains',
        value: '',
      },
    ]);
  };

  const handleUpdate = (id: string, patch: Partial<ConditionRow>) => {
    onConditionsChange(
      conditions.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const handleRemove = (id: string) => {
    onConditionsChange(conditions.filter((row) => row.id !== id));
  };

  return (
    <div className="advanced-search">
      <div className="advanced-search__header">
        <label className="advanced-search__combinator">
          <span>結合</span>
          <select
            aria-label="条件結合"
            value={combinator}
            onChange={(event) => onCombinatorChange(event.target.value as 'AND' | 'OR')}
          >
            <option value="AND">AND (全て満たす)</option>
            <option value="OR">OR (いずれか)</option>
          </select>
        </label>
        <label className="advanced-search__trace-depth">
          <span>トレース深さ</span>
          <input
            aria-label="トレース深さ"
            type="number"
            min={1}
            max={5}
            value={traceDepth}
            onChange={(event) => onTraceDepthChange(Number(event.target.value) || 1)}
          />
        </label>
        <button type="button" className="advanced-search__add" onClick={handleAdd}>
          条件を追加
        </button>
      </div>

      <div className="advanced-search__rows" role="list">
        {conditions.length === 0 ? (
          <p className="advanced-search__empty">条件を追加してください。</p>
        ) : (
          conditions.map((row) => (
            <div key={row.id} className="advanced-search__row" role="listitem">
              <label className="sr-only" htmlFor={`field-${row.id}`}>
                フィールド
              </label>
              <select
                id={`field-${row.id}`}
                value={row.field}
                onChange={(event) => handleUpdate(row.id, { field: event.target.value as SearchField })}
              >
                {FIELD_OPTIONS.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor={`op-${row.id}`}>
                演算子
              </label>
              <select
                id={`op-${row.id}`}
                value={row.operator}
                onChange={(event) => handleUpdate(row.id, { operator: event.target.value as SearchOperator })}
              >
                {OPERATOR_OPTIONS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor={`value-${row.id}`}>
                値
              </label>
              <input
                id={`value-${row.id}`}
                type="text"
                value={row.value}
                onChange={(event) => handleUpdate(row.id, { value: event.target.value })}
                placeholder="値"
              />

              <button type="button" className="advanced-search__remove" onClick={() => handleRemove(row.id)}>
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
