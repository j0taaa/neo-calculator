import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { directions } from "@/components/design-proposals/directions";

export default function DesignProposals() {
  return (
    <main className="design-gallery">
      <header>
        <Link href="/" className="design-back">
          <ArrowLeft size={16} /> Back to calculator
        </Link>
        <span className="design-wordmark">
          neo<span> / </span>design explorations
        </span>
      </header>
      <div className="gallery-intro">
        <p className="design-eyebrow">THREE DIRECTIONS. ONE CALCULATOR.</p>
        <h1>
          A new home for
          <br />
          your cloud ideas.
        </h1>
        <p>
          Explore three ways NeoCalculator could feel. Open a direction, try the
          controls, and see which one feels right.
        </p>
      </div>
      <div className="design-gallery-grid">
        {directions.map((direction) => (
          <Link
            key={direction.id}
            href={`/designs/${direction.id}`}
            className={`design-preview-card ${direction.id}`}
          >
            <div className="design-miniature" aria-hidden="true">
              <div className="mini-top">
                <b>neo</b>
                <span>Cloud workspace</span>
                <i />
              </div>
              <div className="mini-content">
                <div className="mini-rail">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="mini-form">
                  <small>YOUR INFRASTRUCTURE</small>
                  <strong>Elastic Cloud Server</strong>
                  <div className="mini-choices">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="mini-fields">
                    <i />
                    <i />
                  </div>
                  <div className="mini-fields">
                    <i />
                    <i />
                  </div>
                  <div className="mini-action" />
                </div>
                <div className="mini-cart">
                  <small>ESTIMATE</small>
                  <strong>$57.36</strong>
                  <i />
                  <i />
                  <div />
                </div>
              </div>
            </div>
            <div className="design-card-copy">
              <div>
                <span className="design-eyebrow">
                  {direction.number} / {direction.name}
                </span>
                <ArrowUpRight size={22} />
              </div>
              <h2>{direction.tagline}</h2>
              <p>{direction.description}</p>
              <div className="design-traits">
                {direction.traits.map((trait) => (
                  <span key={trait}>{trait}</span>
                ))}
              </div>
              <strong className="design-open">
                Explore {direction.name} <span>→</span>
              </strong>
            </div>
          </Link>
        ))}
      </div>
      <footer>
        Interactive visual prototypes. Sample data only; your saved carts and
        current calculator are unchanged.
      </footer>
    </main>
  );
}
