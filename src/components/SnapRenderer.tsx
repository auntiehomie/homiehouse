'use client';

import React, { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapElement {
  type: string;
  props?: Record<string, any>;
  children?: string[];
  on?: {
    press?: {
      action: string;
      params?: Record<string, any>;
    };
  };
}

export interface SnapData {
  version: string;
  theme?: { accent?: string };
  ui: {
    root: string;
    elements: Record<string, SnapElement>;
  };
}

export interface SnapAction {
  action: string;
  params?: Record<string, any>;
}

interface SnapRendererProps {
  snap: SnapData;
  onAction: (action: SnapAction, inputs: Record<string, unknown>) => Promise<void>;
  submitting?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function accentColor(accent?: string): string {
  const map: Record<string, string> = {
    purple: '#a855f7', blue: '#3b82f6', green: '#22c55e',
    red: '#ef4444', orange: '#f97316', yellow: '#eab308',
    pink: '#ec4899', cyan: '#06b6d4',
  };
  return accent ? (map[accent] ?? accent) : '#71717a';
}

// ─── Leaf element renderers ───────────────────────────────────────────────────

function SnapText({ props }: { props?: Record<string, any> }) {
  const sizeMap: Record<string, string> = {
    xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg',
    xl: 'text-xl', '2xl': 'text-2xl',
  };
  const weightMap: Record<string, string> = {
    normal: 'font-normal', medium: 'font-medium',
    semibold: 'font-semibold', bold: 'font-bold',
  };
  const alignMap: Record<string, string> = {
    left: 'text-left', center: 'text-center', right: 'text-right',
  };

  const cls = [
    sizeMap[props?.size] ?? 'text-sm',
    weightMap[props?.weight] ?? 'font-normal',
    alignMap[props?.align] ?? '',
    'text-zinc-200 leading-snug',
  ].filter(Boolean).join(' ');

  const style: React.CSSProperties = props?.maxLines
    ? { display: '-webkit-box', WebkitLineClamp: props.maxLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
    : {};

  return <p className={cls} style={style}>{props?.content ?? ''}</p>;
}

function SnapImage({ props }: { props?: Record<string, any> }) {
  const aspectMap: Record<string, string> = {
    square: 'aspect-square', '1:1': 'aspect-square',
    '16:9': 'aspect-video', '4:3': 'aspect-[4/3]',
    '3:2': 'aspect-[3/2]', '2:1': 'aspect-[2/1]',
  };
  return (
    <div className={aspectMap[props?.aspect] ?? 'aspect-video'}>
      <img
        src={props?.url}
        alt={props?.alt ?? ''}
        className="w-full h-full object-cover rounded-lg"
        loading="lazy"
      />
      {(props?.title || props?.subtitle) && (
        <div className="mt-1">
          {props.title && <p className="text-xs font-medium text-zinc-300">{props.title}</p>}
          {props.subtitle && <p className="text-xs text-zinc-500">{props.subtitle}</p>}
        </div>
      )}
    </div>
  );
}

function SnapBadge({ props }: { props?: Record<string, any> }) {
  const variantMap: Record<string, string> = {
    default: 'bg-zinc-800 text-zinc-300',
    success: 'bg-green-900/60 text-green-300',
    warning: 'bg-yellow-900/60 text-yellow-300',
    error: 'bg-red-900/60 text-red-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${variantMap[props?.variant] ?? variantMap.default}`}>
      {props?.label}
    </span>
  );
}

function SnapProgress({ props }: { props?: Record<string, any> }) {
  const value = props?.value ?? 0;
  const max = props?.max ?? 100;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div>
      {props?.label && <p className="text-xs text-zinc-400 mb-1">{props.label}</p>}
      <div className="w-full bg-zinc-800 rounded-full h-2">
        <div className="bg-zinc-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SnapSeparator({ props }: { props?: Record<string, any> }) {
  return props?.orientation === 'vertical'
    ? <div className="w-px bg-zinc-800 self-stretch" />
    : <div className="w-full border-t border-zinc-800 my-1" />;
}

function SnapBarChart({ props }: { props?: Record<string, any> }) {
  const bars: { label?: string; value: number }[] = props?.bars ?? [];
  const max = props?.max ?? Math.max(...bars.map(b => b.value), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {bars.map((bar, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full bg-zinc-600 rounded-sm"
            style={{ height: `${(bar.value / max) * 64}px` }}
          />
          {bar.label && <span className="text-[9px] text-zinc-500 truncate w-full text-center">{bar.label}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Field renderers (stateful via callbacks) ─────────────────────────────────

function SnapInput({ props, value, onChange }: { props?: Record<string, any>; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      {props?.label && <label className="block text-xs text-zinc-400 mb-1">{props.label}</label>}
      <input
        type={props?.type === 'number' ? 'number' : 'text'}
        placeholder={props?.placeholder ?? ''}
        maxLength={props?.maxLength}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none focus:border-zinc-500"
      />
    </div>
  );
}

function SnapSlider({ props, value, onChange }: { props?: Record<string, any>; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      {props?.label && (
        <div className="flex justify-between text-xs text-zinc-400 mb-1">
          <span>{props.label}</span>
          {props.showValue && <span>{value}</span>}
        </div>
      )}
      <input
        type="range"
        min={props?.min ?? 0}
        max={props?.max ?? 100}
        step={props?.step ?? 1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-zinc-400"
      />
    </div>
  );
}

function SnapSwitch({ props, value, onChange }: { props?: Record<string, any>; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-zinc-400' : 'bg-zinc-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      {props?.label && <span className="text-sm text-zinc-300">{props.label}</span>}
    </label>
  );
}

function SnapToggleGroup({ props, value, onChange }: { props?: Record<string, any>; value: string | string[]; onChange: (v: string | string[]) => void }) {
  const options: { label: string; value: string }[] = props?.options ?? [];
  const multiple = props?.multiple ?? false;
  const selected = Array.isArray(value) ? value : [value].filter(Boolean);

  const toggle = (v: string) => {
    if (multiple) {
      const arr = selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v];
      onChange(arr);
    } else {
      onChange(v);
    }
  };

  const vertical = props?.orientation === 'vertical';
  return (
    <div>
      {props?.label && <p className="text-xs text-zinc-400 mb-1">{props.label}</p>}
      <div className={`flex ${vertical ? 'flex-col' : 'flex-row flex-wrap'} gap-1`}>
        {options.map(opt => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                active ? 'bg-zinc-200 text-black border-zinc-200' : 'bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Recursive element renderer ───────────────────────────────────────────────

interface SnapElementProps {
  id: string;
  elements: Record<string, SnapElement>;
  fieldValues: Record<string, unknown>;
  onFieldChange: (name: string, value: unknown) => void;
  onPress: (action: SnapAction, inputs: Record<string, unknown>) => void;
  submitting: boolean;
  accent: string;
}

function SnapEl({ id, elements, fieldValues, onFieldChange, onPress, submitting, accent }: SnapElementProps) {
  const el = elements[id];
  if (!el) return null;

  const children = el.children?.map(childId => (
    <SnapEl
      key={childId}
      id={childId}
      elements={elements}
      fieldValues={fieldValues}
      onFieldChange={onFieldChange}
      onPress={onPress}
      submitting={submitting}
      accent={accent}
    />
  )) ?? [];

  const handlePress = () => {
    if (!el.on?.press) return;
    onPress(el.on.press, fieldValues);
  };

  switch (el.type) {
    // ── Containers ──
    case 'stack': {
      const dir = el.props?.direction === 'horizontal' ? 'flex-row' : 'flex-col';
      const gapMap: Record<number, string> = { 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 6: 'gap-6', 8: 'gap-8' };
      const gap = gapMap[el.props?.gap] ?? 'gap-2';
      const justifyMap: Record<string, string> = {
        start: 'justify-start', end: 'justify-end',
        center: 'justify-center', 'space-between': 'justify-between',
      };
      const justify = justifyMap[el.props?.justify] ?? '';
      const cols = el.props?.columns ? `grid grid-cols-${el.props.columns}` : `flex ${dir}`;
      return <div className={`${cols} ${gap} ${justify}`}>{children}</div>;
    }

    case 'item_group':
      return (
        <div className={`${el.props?.border ? 'border border-zinc-800 rounded-lg overflow-hidden' : ''}`}>
          {el.children?.map((childId, i) => (
            <React.Fragment key={childId}>
              <SnapEl id={childId} elements={elements} fieldValues={fieldValues}
                onFieldChange={onFieldChange} onPress={onPress} submitting={submitting} accent={accent} />
              {el.props?.separator && i < (el.children?.length ?? 0) - 1 && (
                <div className="border-t border-zinc-800" />
              )}
            </React.Fragment>
          ))}
        </div>
      );

    case 'paginator': {
      const [page, setPage] = useState(el.props?.initialPage ?? 0);
      const pages = el.children ?? [];
      return (
        <div>
          <SnapEl id={pages[page]} elements={elements} fieldValues={fieldValues}
            onFieldChange={onFieldChange} onPress={onPress} submitting={submitting} accent={accent} />
          {(el.props?.showControls !== false) && pages.length > 1 && (
            <div className="flex items-center justify-between mt-2">
              <button onClick={() => setPage((p: number) => Math.max(0, p - 1))} disabled={page === 0}
                className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30">← Prev</button>
              {el.props?.showIndicators !== false && (
                <div className="flex gap-1">
                  {pages.map((_, i) => (
                    <button key={i} onClick={() => setPage(i)}
                      className={`w-1.5 h-1.5 rounded-full ${i === page ? 'bg-zinc-400' : 'bg-zinc-700'}`} />
                  ))}
                </div>
              )}
              <button onClick={() => setPage((p: number) => Math.min(pages.length - 1, p + 1))} disabled={page === pages.length - 1}
                className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30">Next →</button>
            </div>
          )}
        </div>
      );
    }

    // ── Display ──
    case 'text':
      return <SnapText props={el.props} />;

    case 'image':
      return <SnapImage props={el.props} />;

    case 'badge':
      return <SnapBadge props={el.props} />;

    case 'progress':
      return <SnapProgress props={el.props} />;

    case 'separator':
      return <SnapSeparator props={el.props} />;

    case 'bar_chart':
      return <SnapBarChart props={el.props} />;

    case 'icon':
      return <span className="text-zinc-400 text-base" title={el.props?.name}>◆</span>;

    case 'item': {
      const hasPress = !!el.on?.press;
      const Wrapper = hasPress ? 'button' : 'div';
      return (
        <Wrapper
          onClick={hasPress ? handlePress : undefined}
          className={`flex items-center gap-3 p-2 ${hasPress ? 'hover:bg-zinc-800 cursor-pointer rounded-lg w-full text-left' : ''}`}
        >
          {el.props?.media && (
            <img src={el.props.media} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{el.props?.title}</p>
            {el.props?.description && <p className="text-xs text-zinc-500 truncate">{el.props.description}</p>}
          </div>
          {children}
        </Wrapper>
      );
    }

    // ── Button ──
    case 'button': {
      const variantMap: Record<string, string> = {
        primary: 'bg-zinc-100 text-black hover:bg-white',
        secondary: 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700',
        destructive: 'bg-red-600 text-white hover:bg-red-500',
        ghost: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800',
      };
      const variant = el.props?.variant ?? 'primary';
      return (
        <button
          type="button"
          onClick={handlePress}
          disabled={submitting}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-40 ${variantMap[variant] ?? variantMap.primary}`}
        >
          {submitting ? '…' : el.props?.label}
        </button>
      );
    }

    // ── Fields ──
    case 'input':
      return (
        <SnapInput
          props={el.props}
          value={(fieldValues[el.props?.name] as string) ?? el.props?.defaultValue ?? ''}
          onChange={v => onFieldChange(el.props?.name, v)}
        />
      );

    case 'slider':
      return (
        <SnapSlider
          props={el.props}
          value={(fieldValues[el.props?.name] as number) ?? el.props?.defaultValue ?? el.props?.min ?? 0}
          onChange={v => onFieldChange(el.props?.name, v)}
        />
      );

    case 'switch':
      return (
        <SnapSwitch
          props={el.props}
          value={(fieldValues[el.props?.name] as boolean) ?? el.props?.defaultChecked ?? false}
          onChange={v => onFieldChange(el.props?.name, v)}
        />
      );

    case 'toggle_group':
      return (
        <SnapToggleGroup
          props={el.props}
          value={(fieldValues[el.props?.name] as string | string[]) ?? el.props?.defaultValue ?? ''}
          onChange={v => onFieldChange(el.props?.name, v)}
        />
      );

    case 'cell_grid': {
      const cols = el.props?.cols ?? 3;
      const cells: { label?: string; value?: string; image?: string }[] = el.props?.cells ?? [];
      return (
        <div className={`grid grid-cols-${cols} gap-${el.props?.gap ?? 2}`}>
          {cells.map((cell, i) => (
            <div key={i} className="flex flex-col items-center gap-1 p-2 bg-zinc-800/50 rounded-lg">
              {cell.image && <img src={cell.image} alt="" className="w-full aspect-square object-cover rounded" />}
              {cell.label && <span className="text-xs text-zinc-400">{cell.label}</span>}
              {cell.value && <span className="text-sm font-medium text-zinc-200">{cell.value}</span>}
            </div>
          ))}
        </div>
      );
    }

    default:
      return <div>{children}</div>;
  }
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function SnapRenderer({ snap, onAction, submitting = false }: SnapRendererProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
  const accent = accentColor(snap.theme?.accent);

  const handleFieldChange = useCallback((name: string, value: unknown) => {
    setFieldValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const handlePress = useCallback((action: SnapAction, inputs: Record<string, unknown>) => {
    onAction(action, inputs);
  }, [onAction]);

  return (
    <div
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 overflow-hidden"
      style={{ '--snap-accent': accent } as React.CSSProperties}
    >
      <SnapEl
        id={snap.ui.root}
        elements={snap.ui.elements}
        fieldValues={fieldValues}
        onFieldChange={handleFieldChange}
        onPress={handlePress}
        submitting={submitting}
        accent={accent}
      />
    </div>
  );
}
