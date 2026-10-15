"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  Cpu,
  Database,
  Globe2,
  HardDrive,
  Layers3,
  LayoutGrid,
  Minus,
  Network,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateResourceButton } from "@/components/dashboard/create-resource-button";
import { directions, type Direction } from "./directions";

// Deliberately illustrative data, isolated from both published pricing and saved carts.
// These routes are visual proposals, not an alternative calculation engine.
const services = [
  {
    id: "ecs",
    name: "Elastic Cloud Server",
    short: "ECS",
    category: "Compute",
    icon: Cpu,
    description: "Flexible compute for whatever comes next.",
    specs: ["2 vCPUs · 8 GiB", "4 vCPUs · 16 GiB", "8 vCPUs · 32 GiB"],
    rates: [0.072, 0.144, 0.288],
  },
  {
    id: "rds",
    name: "Relational Database Service",
    short: "RDS",
    category: "Database",
    icon: Database,
    description: "A dependable foundation for your application data.",
    specs: ["2 vCPUs · 4 GiB", "4 vCPUs · 8 GiB", "8 vCPUs · 16 GiB"],
    rates: [0.16, 0.32, 0.64],
  },
  {
    id: "elb",
    name: "Elastic Load Balance",
    short: "ELB",
    category: "Networking",
    icon: Network,
    description: "Keep your traffic flowing to the right place.",
    specs: ["Small", "Medium", "Large"],
    rates: [0.035, 0.07, 0.14],
  },
  {
    id: "evs",
    name: "Elastic Volume Service",
    short: "EVS",
    category: "Storage",
    icon: HardDrive,
    description: "Persistent storage with room to grow.",
    specs: [
      "100 GiB · General purpose",
      "200 GiB · General purpose",
      "500 GiB · General purpose",
    ],
    rates: [0.006575, 0.01315, 0.032875],
  },
] as const;
type SampleResource = {
  id: number;
  name: string;
  service: string;
  spec: string;
  region: string;
  total: number;
};
const initialItems: SampleResource[] = [
  {
    id: 1,
    name: "Application server",
    service: "ECS",
    spec: "2 vCPUs · 8 GiB",
    region: "Singapore",
    total: 52.56,
  },
  {
    id: 2,
    name: "Application storage",
    service: "EVS",
    spec: "100 GiB · General purpose",
    region: "Singapore",
    total: 4.8,
  },
];
const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );

export function DesignWorkbench({ direction }: { direction: Direction }) {
  const [serviceId, setServiceId] = useState<string>("ecs");
  const [query, setQuery] = useState("");
  const [spec, setSpec] = useState(0);
  const [region, setRegion] = useState("Singapore");
  const [billing, setBilling] = useState("hourly");
  const [duration, setDuration] = useState("730");
  const [quantity, setQuantity] = useState("1");
  const [name, setName] = useState("");
  const [items, setItems] = useState(initialItems);
  const [cartName, setCartName] = useState("My first estimate");
  const [notice, setNotice] = useState("");
  const nextId = useRef(3);
  const id = useId();
  const service = services.find((s) => s.id === serviceId)!;
  const Icon = service.icon;
  const currentDirection = directions.find((d) => d.id === direction)!;
  const valid =
    Number.isFinite(Number(duration)) &&
    Number(duration) > 0 &&
    Number(duration) <= 876000 &&
    Number.isInteger(Number(quantity)) &&
    Number(quantity) > 0 &&
    Number(quantity) <= 999;
  const quote = valid
    ? service.rates[spec] *
      Number(duration) *
      Number(quantity) *
      (billing === "monthly" ? 730 : 1)
    : 0;
  const total = items.reduce((sum, item) => sum + item.total, 0);
  function chooseService(next: string) {
    setServiceId(next);
    setSpec(0);
    setNotice("");
  }
  function chooseBilling(next: string) {
    setBilling(next);
    setDuration(next === "monthly" ? "1" : "730");
  }

  const brand = (
    <Link
      href="/designs"
      className="proposal-brand"
      aria-label="Neo design proposals"
    >
      <span className="brand-symbol">
        <Layers3 size={21} />
      </span>
      <b>
        neo<span>calculator</span>
      </b>
    </Link>
  );
  const library = (
    <section className="proposal-library" aria-label="Service library">
      <div className="section-label">
        <span>Service library</span>
        <span className="tiny-count">04</span>
      </div>
      <label className="proposal-search">
        <Search size={16} />
        <input
          aria-label="Search sample services"
          placeholder="Find a service…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="service-list">
        {services
          .filter((s) =>
            `${s.name} ${s.short} ${s.category}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((s) => (
            <button
              type="button"
              className={`service-tile ${serviceId === s.id ? "selected" : ""}`}
              key={s.id}
              onClick={() => chooseService(s.id)}
              aria-pressed={serviceId === s.id}
              aria-label={`${s.short} ${s.category}`}
            >
              <span className="service-icon">
                <s.icon size={19} />
              </span>
              <span>
                <strong>{s.short}</strong>
                <small>{s.category}</small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
        {!services.some((s) =>
          `${s.name} ${s.short} ${s.category}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        ) && <p className="empty-search">No sample services found.</p>}
      </div>
      <p className="library-note">
        Four services to explore
        <br />
        this design direction.
      </p>
    </section>
  );

  const configuration = (
    <section className="proposal-config" aria-labelledby={`${id}-service`}>
      <div className="config-heading">
        <span className="large-service-icon">
          <Icon size={25} />
        </span>
        <div>
          <p className="design-eyebrow">
            {service.category} / {service.short}
          </p>
          <h2 id={`${id}-service`}>{service.name}</h2>
          <p>{service.description}</p>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          setItems((previous) => [
            ...previous,
            {
              id: nextId.current++,
              name: name.trim() || service.name,
              service: service.short,
              spec: service.specs[spec],
              region,
              total: quote,
            },
          ]);
          setNotice(
            `${name.trim() || service.short} added to the preview cart.`,
          );
        }}
      >
        <div className="config-section">
          <div className="form-section-title">
            <span>01</span>
            <h3>Choose your setup</h3>
          </div>
          <div className="proposal-fields">
            <label htmlFor={`${id}-region`}>
              Region
              <select
                id={`${id}-region`}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option>Singapore</option>
                <option>São Paulo</option>
                <option>Frankfurt</option>
              </select>
            </label>
            <label htmlFor={`${id}-name`}>
              Resource name <span className="optional">Optional</span>
              <input
                id={`${id}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="e.g. Application server"
              />
            </label>
          </div>
          <fieldset>
            <legend>
              {service.id === "ecs" || service.id === "rds"
                ? "Instance size"
                : "Specification"}
            </legend>
            <div className="spec-options">
              {service.specs.map((label, index) => (
                <button
                  type="button"
                  key={label}
                  aria-pressed={spec === index}
                  className={spec === index ? "selected" : ""}
                  onClick={() => setSpec(index)}
                >
                  <span>
                    {index === 0
                      ? "Essentials"
                      : index === 1
                        ? "Performance"
                        : "Scale"}
                  </span>
                  <strong>{label}</strong>
                  <small>
                    {spec === index ? (
                      <>
                        <Check size={12} /> Selected
                      </>
                    ) : (
                      "Select configuration"
                    )}
                  </small>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="config-section">
          <div className="form-section-title">
            <span>02</span>
            <h3>Set your usage</h3>
          </div>
          <fieldset>
            <legend>Billing mode</legend>
            <div className="billing-options">
              {[
                { id: "hourly", label: "Pay-per-use" },
                { id: "monthly", label: "Monthly" },
              ].map((mode) => (
                <button
                  type="button"
                  key={mode.id}
                  aria-pressed={billing === mode.id}
                  onClick={() => chooseBilling(mode.id)}
                  className={billing === mode.id ? "selected" : ""}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="proposal-fields">
            <label htmlFor={`${id}-duration`}>
              Duration
              <div className="input-suffix">
                <input
                  id={`${id}-duration`}
                  aria-label="Duration"
                  type="number"
                  min="0.01"
                  max="876000"
                  step="any"
                  required
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
                <span>{billing === "monthly" ? "months" : "hours"}</span>
              </div>
            </label>
            <label htmlFor={`${id}-quantity`}>
              Quantity
              <div className="quantity-input">
                <Button
                  variant="ghost"
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={Number(quantity) <= 1}
                  onClick={() =>
                    setQuantity(String(Math.max(1, Number(quantity) - 1)))
                  }
                >
                  <Minus size={14} />
                </Button>
                <input
                  id={`${id}-quantity`}
                  aria-label="Quantity"
                  type="number"
                  min="1"
                  max="999"
                  required
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <Button
                  variant="ghost"
                  type="button"
                  aria-label="Increase quantity"
                  disabled={Number(quantity) >= 999}
                  onClick={() =>
                    setQuantity(String(Math.min(999, Number(quantity) + 1)))
                  }
                >
                  <Plus size={14} />
                </Button>
              </div>
            </label>
          </div>
        </div>
        <div className="configuration-footer">
          <div>
            <span>
              Resource estimate <small>USD · sample</small>
            </span>
            <strong data-testid="proposal-price">{money(quote)}</strong>
          </div>
          <Button type="submit" className="proposal-primary" disabled={!valid}>
            Add to estimate <Plus size={17} />
          </Button>
        </div>
        <p className="proposal-notice" role="status">
          {notice || "Sample pricing for design exploration only."}
        </p>
      </form>
    </section>
  );

  const cart = (
    <aside
      className="proposal-cart"
      id="preview-estimate"
      aria-label="Sample estimate"
    >
      <div className="cart-title">
        <span className="cart-icon">
          <ShoppingBag size={20} />
        </span>
        <div>
          <p className="design-eyebrow">YOUR ESTIMATE</p>
          <h2>{cartName}</h2>
        </div>
        <CreateResourceButton
          kind="cart"
          onCreate={(newName) => {
            setCartName(newName);
            setItems([]);
            setNotice(
              "New preview cart created. Nothing is saved to your account.",
            );
          }}
        />
      </div>
      <div className="cart-items">
        <div className="cart-table-heading">
          <span>Resource</span>
          <span>Estimate / USD</span>
        </div>
        {items.length ? (
          items.map((item) => (
            <div className="sample-cart-item" key={item.id}>
              <span className="cart-item-icon">
                {item.service === "ECS" ? (
                  <Cpu size={17} />
                ) : item.service === "RDS" ? (
                  <Database size={17} />
                ) : item.service === "ELB" ? (
                  <Network size={17} />
                ) : (
                  <HardDrive size={17} />
                )}
              </span>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.service} · {item.spec}
                </small>
                <small>{item.region}</small>
              </div>
              <b>{money(item.total)}</b>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() =>
                  setItems((previous) =>
                    previous.filter((row) => row.id !== item.id),
                  )
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))
        ) : (
          <div className="empty-cart">
            <ShoppingBag size={28} />
            <p>A little room for your next idea.</p>
            <small>Configure a resource to get started.</small>
          </div>
        )}
      </div>
      <div className="cart-summary">
        <div>
          <span>
            {items.length} {items.length === 1 ? "resource" : "resources"}
          </span>
          <span>USD</span>
        </div>
        <p>
          <span>Estimated total</span>
          <strong data-testid="proposal-total">{money(total)}</strong>
        </p>
        <div className="cost-bar" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <small>Illustrative prices, excluding taxes.</small>
      </div>
      <div className="preview-cart-note">
        <CircleHelp size={15} />
        <span>
          This is a temporary preview cart.
          <br />
          Your real carts are unchanged.
        </span>
      </div>
    </aside>
  );

  return (
    <div className={`design-proposal ${direction}`}>
      <div className="proposal-switcher">
        <Link href="/designs">
          <ArrowLeft size={14} />
          <span>All designs</span>
        </Link>
        <nav aria-label="Design direction">
          {directions.map((d) => (
            <Link
              key={d.id}
              href={`/designs/${d.id}`}
              aria-current={d.id === direction ? "page" : undefined}
            >
              <span>{d.number}</span> {d.name}
            </Link>
          ))}
        </nav>
        <span className="preview-label">Design preview · sample data</span>
      </div>
      {direction === "studio" && (
        <div className="studio-shell">
          <aside className="studio-sidebar">
            {brand}
            <div className="workspace-label">
              <span className="workspace-avatar">P</span>
              <div>
                Personal workspace<small>No account needed</small>
              </div>
            </div>
            <nav className="workspace-nav" aria-label="Preview workspace">
              <a href="#configuration" className="active">
                <LayoutGrid size={17} />
                Calculator
              </a>
              <a href="#preview-estimate">
                <ShoppingBag size={17} />
                My estimate<span>{items.length}</span>
              </a>
            </nav>
            {library}
            <Link href="/" className="return-live">
              <ArrowLeft size={15} />
              Current calculator
            </Link>
          </aside>
          <main className="studio-main">
            <header className="workspace-header">
              <span>
                Workspace <ChevronRight size={14} /> Calculator
              </span>
              <span>
                <Globe2 size={14} />
                USD
              </span>
            </header>
            <div className="workspace-body">
              <div className="page-heading">
                <div>
                  <p className="design-eyebrow">
                    CLOUD COST PLANNING, SIMPLIFIED
                  </p>
                  <h1>Build something great.</h1>
                  <p>Start with a service. Make it your own.</p>
                </div>
                <span className="page-badge">
                  <Cloud size={15} />
                  Huawei Cloud
                </span>
              </div>
              <div className="studio-grid">
                <div id="configuration">{configuration}</div>
                {cart}
              </div>
            </div>
          </main>
        </div>
      )}
      {direction === "console" && (
        <>
          <header className="console-header">
            {brand}
            <nav aria-label="Preview workspace">
              <a href="#configuration" className="active">
                Calculator
              </a>
              <a href="#preview-estimate">
                Estimate <span>{items.length}</span>
              </a>
              <Link href="/">
                Current app <ArrowRight size={13} />
              </Link>
            </nav>
            <span className="console-workspace">
              <span className="status-dot" />
              Personal workspace
            </span>
          </header>
          <main className="console-body">
            <div className="console-heading">
              <div>
                <p className="design-eyebrow">WORKBENCH / CALCULATOR</p>
                <h1>
                  Infrastructure estimate<span>_</span>
                </h1>
              </div>
              <span className="console-meta">
                USD <span>/</span> {items.length} resources
              </span>
            </div>
            <div className="console-grid">
              {library}
              <div id="configuration">{configuration}</div>
              <aside className="console-overview">
                <p className="design-eyebrow">ESTIMATE OVERVIEW</p>
                <span className="overview-total">{money(total)}</span>
                <p>Across {items.length} resources</p>
                <div className="overview-divider" />
                <div>
                  <span>Currency</span>
                  <b>USD</b>
                </div>
                <div>
                  <span>Workspace</span>
                  <b>Personal</b>
                </div>
                <a href="#preview-estimate">
                  View resource table <ArrowDown size={14} />
                </a>
                <small>Sample data. No live pricing requests.</small>
              </aside>
            </div>
            {cart}
          </main>
          <footer className="console-footer">
            <span>
              <span className="status-dot" />
              Design sandbox
            </span>
            <span>NEO / {currentDirection.number}</span>
          </footer>
        </>
      )}
      {direction === "atelier" && (
        <>
          <header className="atelier-header">
            {brand}
            <nav aria-label="Preview workspace">
              <a href="#configuration">The calculator</a>
              <a href="#preview-estimate">
                Your estimate <span>{items.length}</span>
              </a>
            </nav>
            <Link href="/" className="atelier-live">
              Current app <ArrowRight size={16} />
            </Link>
          </header>
          <main className="atelier-body">
            <div className="atelier-intro">
              <p className="design-eyebrow">
                A LITTLE CLARITY FOR YOUR NEXT BIG IDEA
              </p>
              <h1>
                Good ideas start
                <br />
                with <em>a clear picture.</em>
              </h1>
              <div>
                <p>
                  Your infrastructure, thoughtfully estimated.
                  <br />
                  Choose a service and find your starting point.
                </p>
                <span className="atelier-cloud">
                  <Cloud size={18} />
                  Built for Huawei Cloud
                </span>
              </div>
            </div>
            {library}
            <div className="atelier-grid">
              <div id="configuration">{configuration}</div>
              {cart}
            </div>
            <footer className="atelier-footer">
              <span>Made for the way you build.</span>
              <span>NeoCalculator / Design exploration 03</span>
            </footer>
          </main>
        </>
      )}
    </div>
  );
}
