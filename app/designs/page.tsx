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
      </header>
      <div className="gallery-intro">
        <h1>Designs</h1>
      </div>
      <div className="design-gallery-grid">
        {directions.map((direction) => (
          <Link
            key={direction.id}
            href={`/designs/${direction.id}`}
            className={`design-preview-card ${direction.id}`}
            aria-label={direction.name}
          >
            <div className="design-miniature" aria-hidden="true">
              <div className="mini-top">
                <b>neo</b>
                <i />
              </div>
              <div className="mini-content">
                <div className="mini-rail">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="mini-form">
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
                <h2>{direction.name}</h2>
                <ArrowUpRight size={22} />
              </div>
              <p>{direction.description}</p>
            </div>
          </Link>
        ))}
      </div>
      <footer>Interactive previews · sample prices</footer>
    </main>
  );
}
