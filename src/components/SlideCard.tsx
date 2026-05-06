import { Slide, SlideContent, BulletItem, SlideColumn } from '@/lib/slideDsl';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ImagePlaceholder({ description }: { description: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-[1cqw] rounded-[0.4cqw] bg-slate-100 border border-slate-200 w-full h-full"
    >
      <svg
        style={{ width: '7cqw', height: '7cqw', flexShrink: 0 }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="#94a3b8"
        strokeWidth={1.2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <p
        style={{
          fontSize: '1.3cqw',
          color: '#94a3b8',
          textAlign: 'center',
          maxWidth: '80%',
          lineHeight: 1.3,
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function BulletList({
  items,
  baseSize = '2cqw',
  color = '#1e293b',
}: {
  items: BulletItem[];
  baseSize?: string;
  color?: string;
}) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.8cqw',
            marginBottom: '0.7cqw',
            paddingLeft: item.level === 2 ? '2.5cqw' : 0,
            fontSize: item.level === 2 ? `calc(${baseSize} * 0.85)` : baseSize,
            color: item.level === 2 ? '#64748b' : color,
            lineHeight: 1.4,
          }}
        >
          <span
            style={{
              flexShrink: 0,
              marginTop: '0.55cqw',
              width: item.level === 2 ? '0.35cqw' : '0.5cqw',
              height: item.level === 2 ? '0.35cqw' : '0.5cqw',
              borderRadius: '50%',
              backgroundColor: item.level === 2 ? '#94a3b8' : 'currentColor',
            }}
          />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

function ColumnContent({ col }: { col: SlideColumn }) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
      {col.heading && (
        <h3
          style={{
            fontSize: '2.1cqw',
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: '0.8cqw',
            marginTop: 0,
            paddingBottom: '0.6cqw',
            borderBottom: '0.2cqw solid #e2e8f0',
          }}
        >
          {col.heading}
        </h3>
      )}
      {col.text && (
        <p
          style={{
            fontSize: '1.7cqw',
            color: '#475569',
            marginBottom: '0.8cqw',
            marginTop: 0,
            lineHeight: 1.5,
          }}
        >
          {col.text}
        </p>
      )}
      {col.bullets.length > 0 && (
        <BulletList items={col.bullets} baseSize="1.7cqw" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide layouts
// ---------------------------------------------------------------------------

function TitleSlide({ content }: { content: SlideContent }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, oklch(0.35 0.15 270) 0%, oklch(0.42 0.17 275) 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6cqw',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative circles */}
      <div
        style={{
          position: 'absolute',
          top: '-8cqw',
          right: '-8cqw',
          width: '25cqw',
          height: '25cqw',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-6cqw',
          left: '-6cqw',
          width: '18cqw',
          height: '18cqw',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }}
      />
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: '80%' }}>
        {content.title && (
          <h1
            style={{
              fontSize: '5.5cqw',
              fontWeight: 800,
              color: '#ffffff',
              margin: 0,
              marginBottom: '2cqw',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}
          >
            {content.title}
          </h1>
        )}
        {content.subtitle && (
          <p
            style={{
              fontSize: '2.2cqw',
              color: 'rgba(255,255,255,0.8)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {content.subtitle}
          </p>
        )}
      </div>
      {/* Bottom accent line */}
      <div
        style={{
          position: 'absolute',
          bottom: '4cqw',
          width: '8cqw',
          height: '0.3cqw',
          background: 'rgba(255,255,255,0.4)',
          borderRadius: '99px',
        }}
      />
    </div>
  );
}

function SectionSlide({ content }: { content: SlideContent }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, oklch(0.62 0.19 25) 0%, oklch(0.70 0.18 30) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6cqw',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '2cqw',
          left: '4cqw',
          width: '1.5cqw',
          height: '6cqw',
          background: 'rgba(255,255,255,0.4)',
          borderRadius: '99px',
        }}
      />
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        {content.heading && (
          <h2
            style={{
              fontSize: '4.5cqw',
              fontWeight: 800,
              color: '#ffffff',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {content.heading}
          </h2>
        )}
      </div>
    </div>
  );
}

function BulletsSlide({ content }: { content: SlideContent }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        padding: '4cqw 5cqw',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '0.6cqw',
          background: 'oklch(0.35 0.15 270)',
        }}
      />
      {content.heading && (
        <h2
          style={{
            fontSize: '3.2cqw',
            fontWeight: 700,
            color: 'oklch(0.35 0.15 270)',
            margin: 0,
            marginBottom: '2.5cqw',
            lineHeight: 1.2,
          }}
        >
          {content.heading}
        </h2>
      )}
      {content.text && (
        <p
          style={{
            fontSize: '1.9cqw',
            color: '#475569',
            margin: 0,
            marginBottom: '1.5cqw',
            lineHeight: 1.5,
          }}
        >
          {content.text}
        </p>
      )}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <BulletList items={content.bullets} baseSize="2cqw" />
      </div>
    </div>
  );
}

function ImageTextSlide({ content }: { content: SlideContent }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        padding: '4cqw 5cqw',
        boxSizing: 'border-box',
      }}
    >
      {content.heading && (
        <h2
          style={{
            fontSize: '2.8cqw',
            fontWeight: 700,
            color: '#1e293b',
            margin: 0,
            marginBottom: '2cqw',
            lineHeight: 1.2,
          }}
        >
          {content.heading}
        </h2>
      )}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: '3cqw',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: '42%', flexShrink: 0 }}>
          <ImagePlaceholder description={content.image ?? 'Imagem'} />
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {content.text && (
            <p
              style={{
                fontSize: '1.9cqw',
                color: '#475569',
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {content.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageBulletsSlide({ content }: { content: SlideContent }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        padding: '4cqw 5cqw',
        boxSizing: 'border-box',
      }}
    >
      {content.heading && (
        <h2
          style={{
            fontSize: '2.8cqw',
            fontWeight: 700,
            color: '#1e293b',
            margin: 0,
            marginBottom: '2cqw',
            lineHeight: 1.2,
          }}
        >
          {content.heading}
        </h2>
      )}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: '3cqw',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: '40%', flexShrink: 0 }}>
          <ImagePlaceholder description={content.image ?? 'Imagem'} />
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <BulletList items={content.bullets} baseSize="1.9cqw" />
        </div>
      </div>
    </div>
  );
}

function TwoColSlide({ content }: { content: SlideContent }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        padding: '4cqw 5cqw',
        boxSizing: 'border-box',
      }}
    >
      {content.heading && (
        <h2
          style={{
            fontSize: '2.8cqw',
            fontWeight: 700,
            color: '#1e293b',
            margin: 0,
            marginBottom: '0.8cqw',
            paddingBottom: '1cqw',
            borderBottom: '0.2cqw solid #e2e8f0',
            lineHeight: 1.2,
          }}
        >
          {content.heading}
        </h2>
      )}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: '3cqw',
          overflow: 'hidden',
          marginTop: '1.5cqw',
        }}
      >
        {content.col1 && (
          <>
            <ColumnContent col={content.col1} />
            <div style={{ width: '0.15cqw', background: '#e2e8f0', flexShrink: 0 }} />
          </>
        )}
        {content.col2 && <ColumnContent col={content.col2} />}
      </div>
    </div>
  );
}

function QuoteSlide({ content }: { content: SlideContent }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'oklch(0.20 0.04 270)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '7cqw',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative quote mark */}
      <div
        style={{
          position: 'absolute',
          top: '2cqw',
          left: '4cqw',
          fontSize: '15cqw',
          color: 'rgba(255,255,255,0.06)',
          fontFamily: 'Georgia, serif',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        "
      </div>
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: '85%' }}>
        {content.quote && (
          <blockquote
            style={{
              fontSize: '2.8cqw',
              fontStyle: 'italic',
              color: '#f8fafc',
              margin: 0,
              marginBottom: '2cqw',
              lineHeight: 1.5,
            }}
          >
            "{content.quote}"
          </blockquote>
        )}
        {content.author && (
          <p
            style={{
              fontSize: '1.8cqw',
              color: 'oklch(0.68 0.19 25)',
              margin: 0,
              fontWeight: 600,
            }}
          >
            — {content.author}
          </p>
        )}
      </div>
    </div>
  );
}

function ClosingSlide({ content }: { content: SlideContent }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, oklch(0.42 0.17 275) 0%, oklch(0.55 0.16 280) 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6cqw',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: '-4cqw',
          right: '-4cqw',
          width: '20cqw',
          height: '20cqw',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)',
        }}
      />
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: '80%' }}>
        {content.title && (
          <h1
            style={{
              fontSize: '5cqw',
              fontWeight: 800,
              color: '#ffffff',
              margin: 0,
              marginBottom: '2cqw',
              lineHeight: 1.2,
            }}
          >
            {content.title}
          </h1>
        )}
        {content.subtitle && (
          <p
            style={{
              fontSize: '2cqw',
              color: 'rgba(255,255,255,0.75)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {content.subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface SlideCardProps {
  slide: Slide;
  showNotes?: boolean;
  /** Optional slide number label shown in corner */
  index?: number;
}

export function SlideCard({ slide, showNotes = false, index }: SlideCardProps) {
  const { layout, content } = slide;

  return (
    <div
      className="@container relative w-full overflow-hidden rounded-lg shadow-sm border border-border/40 select-none"
      style={{ aspectRatio: '16/9' }}
    >
      {layout === 'title' && <TitleSlide content={content} />}
      {layout === 'section' && <SectionSlide content={content} />}
      {layout === 'bullets' && <BulletsSlide content={content} />}
      {layout === 'image-text' && <ImageTextSlide content={content} />}
      {layout === 'image-bullets' && <ImageBulletsSlide content={content} />}
      {layout === 'two-col' && <TwoColSlide content={content} />}
      {layout === 'quote' && <QuoteSlide content={content} />}
      {layout === 'closing' && <ClosingSlide content={content} />}

      {/* Slide index badge */}
      {index !== undefined && (
        <div
          style={{
            position: 'absolute',
            top: '1cqw',
            right: '1.2cqw',
            fontSize: '1.2cqw',
            color: 'rgba(255,255,255,0.7)',
            background: 'rgba(0,0,0,0.25)',
            borderRadius: '0.4cqw',
            padding: '0.2cqw 0.7cqw',
            backdropFilter: 'blur(2px)',
          }}
        >
          {index}
        </div>
      )}

      {/* Presenter notes overlay */}
      {showNotes && content.notes && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(0,0,0,0.7)',
            color: '#f8fafc',
            padding: '1cqw 2cqw',
            fontSize: '1.4cqw',
            lineHeight: 1.4,
            backdropFilter: 'blur(2px)',
          }}
        >
          📝 {content.notes}
        </div>
      )}
    </div>
  );
}
