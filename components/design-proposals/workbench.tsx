"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Cpu,
  Database,
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
    specs: ["2 vCPUs · 8 GiB", "4 vCPUs · 16 GiB", "8 vCPUs · 32 GiB"],
    rates: [0.072, 0.144, 0.288],
  },
  {
    id: "rds",
    name: "Relational Database Service",
    short: "RDS",
    category: "Database",
    icon: Database,
    specs: ["2 vCPUs · 4 GiB", "4 vCPUs · 8 GiB", "8 vCPUs · 16 GiB"],
    rates: [0.16, 0.32, 0.64],
  },
  {
    id: "elb",
    name: "Elastic Load Balance",
    short: "ELB",
    category: "Networking",
    icon: Network,
    specs: ["Small", "Medium", "Large"],
    rates: [0.035, 0.07, 0.14],
  },
  {
    id: "evs",
    name: "Elastic Volume Service",
    short: "EVS",
    category: "Storage",
    icon: HardDrive,
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
  const [cartName, setCartName] = useState("Estimate");
  const [notice, setNotice] = useState("");
  const nextId = useRef(3);
  const id = useId();
  const service = services.find((s) => s.id === serviceId)!;
  const Icon = service.icon;
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
        <span>Services</span>
      </div>
      <label className="proposal-search">
        <Search size={16} />
        <input
          aria-label="Search services"
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
        ) && <p className="empty-search">No services found.</p>}
      </div>
    </section>
  );

  const configuration = (
    <section className="proposal-config" aria-labelledby={`${id}-service`}>
      <div className="config-heading">
        <span className="large-service-icon">
          <Icon size={25} />
        </span>
        <div>
          <h2 id={`${id}-service`}>{service.name}</h2>
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
                  <strong>{label}</strong>
                  <span className="spec-check" aria-hidden="true">
                    {spec === index && <Check size={14} />}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="config-section">
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
            <span>USD</span>
            <strong data-testid="proposal-price">{money(quote)}</strong>
          </div>
          <Button type="submit" className="proposal-primary" disabled={!valid}>
            Add to estimate <Plus size={17} />
          </Button>
        </div>
        <p className="sr-only" role="status">
          {notice}
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
          <h2>{cartName}</h2>
        </div>
        <CreateResourceButton
          kind="cart"
          onCreate={(newName) => {
            setCartName(newName);
            setItems([]);
            setNotice("Cart created.");
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
            <p>No resources</p>
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
          <span>Total</span>
          <strong data-testid="proposal-total">{money(total)}</strong>
        </p>
      </div>
    </aside>
  );

  return (
    <div className={`design-proposal ${direction}`}>
      <h1 className="sr-only">Calculator</h1>
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
              {d.name}
            </Link>
          ))}
        </nav>
        <span className="preview-label">Sample prices</span>
      </div>
      {direction === "studio" && (
        <div className="studio-shell">
          <aside className="studio-sidebar">
            {brand}
            <nav className="workspace-nav" aria-label="Preview workspace">
              <a href="#configuration" className="active">
                <LayoutGrid size={17} />
                Calculator
              </a>
              <a href="#preview-estimate">
                <ShoppingBag size={17} />
                Estimate<span>{items.length}</span>
              </a>
            </nav>
            {library}
            <Link href="/" className="return-live">
              <ArrowLeft size={15} />
              Live calculator
            </Link>
          </aside>
          <main className="studio-main">
            <div className="workspace-body">
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
                Live calculator <ArrowRight size={13} />
              </Link>
            </nav>
          </header>
          <main className="console-body">
            <div className="console-grid">
              {library}
              <div id="configuration">{configuration}</div>
              <aside className="console-overview">
                <p className="design-eyebrow">Total · USD</p>
                <span className="overview-total">{money(total)}</span>
                <p>{items.length} resources</p>
                <a href="#preview-estimate">
                  Resources <ArrowDown size={14} />
                </a>
              </aside>
            </div>
            {cart}
          </main>
        </>
      )}
      {direction === "atelier" && (
        <>
          <header className="atelier-header">
            {brand}
            <nav aria-label="Preview workspace">
              <a href="#configuration">Calculator</a>
              <a href="#preview-estimate">
                Estimate <span>{items.length}</span>
              </a>
            </nav>
            <Link href="/" className="atelier-live">
              Live calculator <ArrowRight size={16} />
            </Link>
          </header>
          <main className="atelier-body">
            {library}
            <div className="atelier-grid">
              <div id="configuration">{configuration}</div>
              {cart}
            </div>
          </main>
        </>
      )}
    </div>
  );
}
