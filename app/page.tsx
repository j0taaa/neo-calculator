import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";

const services = [
  "Elastic Cloud Server",
  "Flexus X Instance",
  "Object Storage Service",
  "Elastic Load Balance",
  "Cloud Container Engine",
  "DataArts Studio",
  "Workspace",
  "Databases",
  "Networking",
  "Analytics",
];

const priceLists = [
  { name: "Core Production", total: "USD 3,715.49" },
  { name: "Growth Batch A", total: "USD 42,325.27" },
  { name: "Growth Batch B", total: "USD 18,998.19" },
  { name: "Ops Sandbox", total: "USD 12,610.50" },
  { name: "AI Trial", total: "USD 3,914.42" },
  { name: "Archive Fleet", total: "USD 2,823.24" },
];

const options = {
  az: ["General AZ", "AZ 2", "AZ 3"],
  billing: ["Yearly/Monthly", "Pay-per-use", "RI"],
  architecture: ["x86", "Kunpeng"],
  types: [
    "General computing-plus",
    "General computing",
    "Memory-optimized",
    "Large-memory",
    "GPU-accelerated",
    "Disk-intensive",
  ],
  sizes: ["c9", "c7n", "c6", "c3", "x2e"],
  vcpus: ["2 vCPUs", "4 vCPUs", "8 vCPUs", "16 vCPUs", "32 vCPUs"],
  ram: ["8 GiB", "16 GiB", "32 GiB", "64 GiB"],
};

function OptionGrid({ items }: { items: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item, i) => (
        <Button key={item} variant={i === 0 ? "default" : "secondary"} className="justify-start rounded-md">
          {item}
        </Button>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-zinc-900 lg:p-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <header className="flex flex-col gap-3 rounded-xl border bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm font-medium text-zinc-500">HUAWEI CLOUD Pricing &gt; Price Calculator</div>
          <div className="flex flex-wrap items-center gap-2">
            <Select defaultValue="total">
              <SelectTrigger className="w-44 bg-white">
                <SelectValue placeholder="Settlement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">By total price</SelectItem>
                <SelectItem value="hourly">By hourly price</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="usd">
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usd">USD</SelectItem>
                <SelectItem value="eur">EUR</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="rounded-full">Old Edition</Button>
          </div>
        </header>

        <main className="grid gap-4 lg:grid-cols-[240px_1fr_320px]">
          <Card className="h-[780px] overflow-hidden">
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input className="pl-9" placeholder="Enter a service name" />
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-0">
              <ScrollArea className="h-[690px] px-2">
                <div className="space-y-1 px-2">
                  {services.map((service, i) => (
                    <Button
                      key={service}
                      variant={i === 0 ? "secondary" : "ghost"}
                      className="h-auto w-full justify-start px-3 py-2 text-left"
                    >
                      {service}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="h-[780px]">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-2xl">Elastic Cloud Server</CardTitle>
                  <p className="text-sm text-zinc-500">Service Overview</p>
                </div>
                <Tabs defaultValue="calculator">
                  <TabsList>
                    <TabsTrigger value="calculator">Price Calculator</TabsTrigger>
                    <TabsTrigger value="details">Product Pricing Details</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-6 py-5">
              <div className="space-y-2">
                <p className="text-sm text-zinc-600">Description (Optional)</p>
                <Input defaultValue="Elastic Cloud Server" className="max-w-sm" />
              </div>

              <section className="space-y-3">
                <p className="text-sm font-medium">Region</p>
                <Select defaultValue="hk">
                  <SelectTrigger className="max-w-sm bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hk">CN-Hong Kong</SelectItem>
                    <SelectItem value="sg">AP-Singapore</SelectItem>
                  </SelectContent>
                </Select>
              </section>

              <section className="space-y-3"><p className="text-sm font-medium">AZ</p><OptionGrid items={options.az} /></section>
              <section className="space-y-3"><p className="text-sm font-medium">Billing Mode</p><OptionGrid items={options.billing} /></section>
              <section className="space-y-3"><p className="text-sm font-medium">CPU Architecture</p><OptionGrid items={options.architecture} /></section>
              <section className="space-y-3"><p className="text-sm font-medium">Type</p><OptionGrid items={options.types} /></section>
              <section className="space-y-3"><p className="text-sm font-medium">Size</p><OptionGrid items={options.sizes} /></section>
              <section className="space-y-3"><p className="text-sm font-medium">vCPUs</p><OptionGrid items={options.vcpus} /></section>
              <section className="space-y-3"><p className="text-sm font-medium">Memory</p><OptionGrid items={options.ram} /></section>

              <div className="rounded-lg border bg-zinc-50 p-3 text-sm text-zinc-600">
                Selected specifications: c9.large.4 | 2 vCPUs | 8 GiB
              </div>
            </CardContent>
            <Separator />
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-600">
                Estimated Price <span className="ml-2 text-4xl font-semibold text-zinc-950">USD 89.11</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline">Buy Now</Button>
                <Button>Add to List</Button>
              </div>
            </div>
          </Card>

          <Card className="h-[780px] overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Tabs defaultValue="my-lists">
                  <TabsList>
                    <TabsTrigger value="price-list">Price List</TabsTrigger>
                    <TabsTrigger value="my-lists">My Lists</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Badge variant="secondary">0</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><Checkbox id="all" /><label htmlFor="all">All</label></div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm">Export</Button>
                  <Button variant="outline" size="sm">New</Button>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="px-0">
              <ScrollArea className="h-[650px] px-4">
                <div className="space-y-3 py-3">
                  {priceLists.map((item) => (
                    <div key={item.name} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="font-medium">{item.name}</p>
                        <Button variant="ghost" size="sm">More</Button>
                      </div>
                      <p className="text-xs uppercase tracking-wide text-zinc-500">Billing mode</p>
                      <p className="text-lg font-semibold">{item.total}</p>
                      <Button variant="link" className="mt-1 h-auto p-0 text-zinc-600">+ Add Product</Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
