"use client";

import { Code, Plus } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import {
  Avatar,
  AvatarStack,
  Badge,
  CommandMenu,
  DomainCard,
  Ladder,
  RecordEntry,
  Seal,
  StatTile,
  Stepper,
  TabCount,
  Ticket,
  TimedButton,
  VentureCard,
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SheetContent,
  SkillChip,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  TIERS,
  TierBadge,
  useToast,
  VerifiedStamp,
} from "@/components/ui";
import { SkillList } from "@/components/skills/skill-list";
import { cn } from "@/lib/cn";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="neu-card flex flex-col gap-4 p-5">
      <h3 className="text-h3 text-text-primary">{title}</h3>
      {children}
    </section>
  );
}

export function GalleryPanel({ theme }: { theme: "light" | "dark" }) {
  const p = (id: string) => `${theme}-${id}`;
  const toast = useToast();
  const [stampKey, setStampKey] = useState(0);
  const [timed, setTimed] = useState<"idle" | "running" | "done">("idle");

  return (
    <div className={cn(theme, "flex flex-col gap-6 bg-bg-page p-5 text-text-primary")} data-theme-panel={theme}>
      <h2 className="font-display text-h2">{theme === "light" ? "Light" : "Dark"}</h2>

      <Section title="Typography">
        <p className="font-display text-display">Prove it.</p>
        <p className="font-display text-h1">Heading 1</p>
        <p className="font-display text-h2">Heading 2</p>
        <p className="text-h3">Heading 3</p>
        <p className="text-h4">Heading 4</p>
        <p className="text-body-lg text-text-secondary">Body large: landing intro paragraphs only.</p>
        <p className="text-body">Body: default copy for posts, cards and forms.</p>
        <p className="text-body-sm text-text-muted">Body small: helper text and secondary descriptions.</p>
        <p className="text-caption text-text-muted">Caption · 2 h ago</p>
        <p className="font-mono text-code text-text-secondary">ahmed/skilient@7f3a9c1</p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">
            <Plus aria-hidden weight="bold" className="size-4" />
            Small
          </Button>
          <Button size="lg">Large</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </div>
      </Section>

      <Section title="Form controls">
        <Field id={p("name")} label="Full name" helper="As it appears on your university card.">
          <Input id={p("name")} placeholder="Ayesha Khan" aria-describedby={`${p("name")}-helper`} />
        </Field>
        <Field id={p("email")} label="University email" error="Use your university email address.">
          <Input id={p("email")} defaultValue="ayesha@gmail.com" aria-invalid="true" aria-describedby={`${p("email")}-error`} />
        </Field>
        <Field id={p("disabled")} label="Username">
          <Input id={p("disabled")} defaultValue="ayesha" disabled />
        </Field>
        <Field id={p("bio")} label="Bio">
          <Textarea id={p("bio")} placeholder="What are you building?" />
        </Field>
        <div className="flex flex-col gap-2">
          <Label id={p("dept-label")} htmlFor={p("dept")}>
            Department
          </Label>
          <Select>
            <SelectTrigger id={p("dept")} aria-labelledby={p("dept-label")}>
              <SelectValue placeholder="Choose a department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cs">Computer Science</SelectItem>
              <SelectItem value="se">Software Engineering</SelectItem>
              <SelectItem value="ee">Electrical Engineering</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox id={p("cb1")} defaultChecked />
            <label htmlFor={p("cb1")} className="text-body">
              Checked
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id={p("cb2")} />
            <label htmlFor={p("cb2")} className="text-body">
              Unchecked
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id={p("cb3")} disabled />
            <label htmlFor={p("cb3")} className="text-body text-text-disabled">
              Disabled
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={p("sw1")} defaultChecked />
            <label htmlFor={p("sw1")} className="text-body">
              Email digest
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={p("sw2")} />
            <label htmlFor={p("sw2")} className="text-body">
              Off
            </label>
          </div>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="skills">
          <TabsList aria-label="Profile sections">
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="work">Work</TabsTrigger>
            <TabsTrigger value="cv" disabled>
              CV
            </TabsTrigger>
          </TabsList>
          <TabsContent value="skills" className="text-body text-text-secondary">
            Skills proven by commits, ventures and reviews.
          </TabsContent>
          <TabsContent value="work" className="text-body text-text-secondary">
            Ventures and contributions.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Dialog, sheet and toast">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent title="Leave venture?" description="You can ask to rejoin later; your verified contributions stay on your record.">
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger">Leave</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open sheet</Button>
            </DialogTrigger>
            <SheetContent title="Filters" description="Narrow the list.">
              <p className="text-body text-text-secondary">Sheet content.</p>
            </SheetContent>
          </Dialog>
          <Button
            variant="secondary"
            onClick={() => toast({ title: "Couldn't save your post", description: "Check your connection and try again.", tone: "error", requestId: "7f3a9c1e-0000" })}
          >
            Show toast
          </Button>
        </div>
      </Section>

      <Section title="Avatar and badges">
        <div className="flex items-center gap-3">
          <Avatar name="Ayesha Khan" size="sm" />
          <Avatar name="Bilal Ahmed" />
          <Avatar name="Sara" size="lg" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="primary">New</Badge>
          <Badge tone="accent">University</Badge>
          <Badge tone="verified">Verified</Badge>
          <Badge tone="success">Completed</Badge>
          <Badge tone="warning">Pending</Badge>
          <Badge tone="error">Failed</Badge>
          <Badge tone="info">Info</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <TierBadge key={t} tier={t} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <SkillChip name="Django" level={4} />
          <SkillChip name="TypeScript" level={3} peerVerified />
          <SkillChip name="React" level={2} />
          <SkillChip name="PostgreSQL" level={1} />
          <SkillChip name="Rust" level={0} />
          <SkillChip name="Figma" verified />
          <SkillChip name="Kotlin" />
        </div>
      </Section>

      <Section title="Skill list and drawer (as a classmate sees it)">
        <SkillList
          ownerName="Ayesha"
          isOwner={false}
          skills={[
            { id: "python", name: "Python", category: "language", level: 3, lastUsedAt: "2026-09-20T10:00:00Z", lastUsedLabel: "20 Sept 2026", peerVerified: true, aiAssisted: false },
            { id: "typescript", name: "TypeScript", category: "language", level: 2, lastUsedAt: "2026-09-25T10:00:00Z", lastUsedLabel: "25 Sept 2026", peerVerified: false, aiAssisted: true },
            { id: "django", name: "Django", category: "framework", level: 2, lastUsedAt: "2026-09-18T10:00:00Z", lastUsedLabel: "18 Sept 2026", peerVerified: false, aiAssisted: false },
            { id: "docker", name: "Docker", category: "tool", level: 1, lastUsedAt: null, lastUsedLabel: null, peerVerified: false, aiAssisted: false },
          ]}
        />
      </Section>

      <Section title="Verified stamp">
        <VerifiedStamp key={stampKey}>Contribution to “Campus Rides” confirmed by 2 teammates</VerifiedStamp>
        <div>
          <Button variant="ghost" size="sm" onClick={() => setStampKey((k) => k + 1)}>
            Replay
          </Button>
        </div>
      </Section>

      <Section title="States">
        <LoadingState label="Loading ventures" />
        <div className="flex gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
        <EmptyState
          title="No ventures yet"
          description="Start one with classmates, or join an open role."
          action={<Button size="sm">Start a venture</Button>}
        />
        <ErrorState description="We couldn't load your feed." requestId="7f3a9c1e-1234" action={<Button variant="secondary" size="sm">Try again</Button>} />
      </Section>

      <Section title="Phase 14 objects">
        <div className="flex flex-wrap items-center gap-4">
          <Seal size={40} label="Verified" />
          <Avatar name="Ayesha Khan" tier="flare" verified size="lg" />
          <AvatarStack people={[{ name: "Ayesha Khan", tier: "flare" }, { name: "Ali Raza", tier: "spark" }, { name: "Sana Malik", tier: "shine" }, { name: "Omar Farooq" }, { name: "Hira Shah" }]} />
          {TIERS.map((t) => (
            <TierBadge key={t} tier={t} size="md" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TimedButton
            state={timed}
            doneLabel="Verified"
            doneAt="2026-11-02T09:32:00Z"
            onClick={() => {
              setTimed("running");
              setTimeout(() => setTimed("done"), 1200);
            }}
          >
            Verify
          </TimedButton>
          <Button variant="tertiary">Tertiary</Button>
          <CommandMenu items={[{ key: "feed", label: "Home", description: "Your feed", href: "/feed", group: "Places" }]} className="max-w-xs" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <DomainCard name="CS Society" tone="signal" pictogram={<Code weight="bold" className="size-6" />} meta={[{ label: "members", value: 128 }, { label: "open roles", value: 3 }]} updated="updated 2 h ago" />
          <VentureCard
            title="Campus Rides"
            href="/ventures"
            kind="Startup"
            members={[{ name: "Ayesha Khan", tier: "flare", role: "Lead" }, { name: "Ali Raza", tier: "spark" }, { name: "Sana Malik" }]}
            open={2}
            highlight="Shipped the driver app beta to 40 students"
            lastActive="active 3 h ago"
            action={<Button size="sm">Join</Button>}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile label="Score" value="612" hint="+18 this week" />
          <StatTile label="Verified skills" value="9" hint="from GitHub · 1 Nov" />
          <StatTile label="Ventures" value="3" hint="1 completed" />
        </div>
        <Ladder
          label="tiers reached"
          steps={[
            { key: "raw", label: "Raw", state: "done", meta: "Sep 2026" },
            { key: "spark", label: "Spark", state: "done", meta: "Oct 2026" },
            { key: "flare", label: "Flare", state: "current", meta: "now" },
            { key: "shine", label: "Shine", state: "next", meta: "88 to go" },
            { key: "radiant", label: "Radiant", state: "later" },
            { key: "luminary", label: "Luminary", state: "later" },
          ]}
        />
        <Stepper steps={["Basics", "When and where", "Who", "Form", "Review"]} current={2} />
        <Ticket title="Build with React" host="CS Society" when="Sat 14 Nov · 16:00" where="NUTECH, Hall B" type="Free" code="TKT-7F3A-91" />
        <ul>
          <RecordEntry issuer="CS Society" title="Attended: Build with React" date="14 Nov 2026" evidence="Checked in 16:04" code="REC-2Q8K-7L" />
          <RecordEntry issuer="Skilient" title="Taught React · 4.5 h" date="2 Dec 2026" status="signing" />
        </ul>
        <p className="flex items-center gap-2 text-body-sm">
          Requests <TabCount>{4}</TabCount>
        </p>
      </Section>
    </div>
  );
}
