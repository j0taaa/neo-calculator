"use client";
import { type ActionMenuItem } from "@/components/home-page-shell-parts";
import {
  Copy,
  Download,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";

import { ActionMenu } from "@/components/home-page-shell-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { DashboardModel } from "@/lib/dashboard/use-dashboard";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  X,
} from "lucide-react";

export function ProjectSidebar({
  projectStore,
  projectActions,
  transfer,
  cloning,
  sharing,
  isSignedIn,
  isProjectCreateMenuOpen,
  setIsProjectCreateMenuOpen,
  openActionModal,
  openProjectMenuId,
  setOpenProjectMenuId,
}: DashboardModel["projects"]) {

  const {
    projects,
    projectsError,
    projectsLoading,
    expandedProjects,
    toggleProject,
    selectedListId,
    setSelectedListId,
  } = projectStore;
  const {
    newProjectName,
    setNewProjectName,
    handleCreateProject,
    newProjectPending,
    editingProjectId,
    renamingProjectId,
    deletingProjectId,
    handleStartProjectRename,
    projectNameDrafts,
    setProjectNameDrafts,
    handleRenameProject,
    handleCancelProjectRename,
    listPendingProjectId,
    handleDeleteProject,
    handleDeleteList,
    deletingListId,
  } = projectActions;
  const {
    importProjectMessage,
    importProjectMessageIsError,
    projectImportMessages,
    projectImportMessageErrors,
    projectExportMessages,
    projectExportMessageErrors,
    openCartImportPicker,
    importCartPendingProjectId,
    handleOpenProjectExport,
    handleExportProjectExcel,
    openProjectImportPicker,
    importProjectPending,
  } = transfer;
  const { projectCloneMessages, projectCloneMessageErrors } = cloning;
  const { projectShareMessages } = sharing;
  const projectCreateMenuItems: ActionMenuItem[] = [
    {
      label: "Import Project",
      icon: <Upload className="size-4" />,
      onSelect: openProjectImportPicker,
      disabled: importProjectPending || !isSignedIn,
    },
  ];
  return (
    <>
      <Card className="min-w-0 overflow-hidden shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>My Projects</CardTitle>
              {isSignedIn && <Link href="/cart" className="mt-1 inline-block text-xs text-zinc-600 underline">Open local carts</Link>}

            </div>
            <Badge variant="secondary">{projects.length}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                className="min-w-0 basis-full"
                placeholder="New project name"
                disabled={!isSignedIn}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateProject}
                disabled={newProjectPending || !isSignedIn}
              >
                {newProjectPending ? "Adding..." : "New Project"}
              </Button>
              <ActionMenu
                open={isProjectCreateMenuOpen}
                onOpenChange={setIsProjectCreateMenuOpen}
                label="Open project actions"
                items={projectCreateMenuItems}
              />
            </div>
            {projectsError ? (
              <p className="text-sm text-red-600">{projectsError}</p>
            ) : null}
            {importProjectMessage ? (
              <p
                className={`text-sm ${importProjectMessageIsError ? "text-red-600" : "text-zinc-600"}`}
              >
                {importProjectMessage}
              </p>
            ) : null}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="px-0">
          <ScrollArea className="px-4 [&>[data-slot=scroll-area-viewport]]:max-h-72 xl:[&>[data-slot=scroll-area-viewport]]:max-h-[calc(100dvh-22rem)]">
            <div className="space-y-3 py-3">
              {!isSignedIn ? (
                <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                  Sign in to save projects. Local Carts and Huawei Carts also work without a Neo account.
                </div>
              ) : null}
              {projectsLoading ? (
                <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                  Loading projects...
                </div>
              ) : null}
              {projects.map((project) => {
                const isExpanded = expandedProjects[project.id] ?? false;
                const isEditingProject = editingProjectId === project.id;
                const isRenamingProject = renamingProjectId === project.id;
                const isDeletingProject = deletingProjectId === project.id;
                const projectCloneMessage =
                  projectCloneMessages[project.id] ?? "";
                const projectCloneIsError =
                  projectCloneMessageErrors[project.id] ?? false;

                const projectImportMessage =
                  projectImportMessages[project.id] ?? "";
                const projectImportMessageIsError =
                  projectImportMessageErrors[project.id] ?? false;
                const projectExportMessage =
                  projectExportMessages[project.id] ?? "";
                const projectExportMessageIsError =
                  projectExportMessageErrors[project.id] ?? false;
                const projectShareMessage =
                  projectShareMessages[project.id] ?? "";
                const projectMenuItems: ActionMenuItem[] = [
                  {
                    label: "Rename Project",
                    icon: <Pencil className="size-4" />,
                    onSelect: () => handleStartProjectRename(project),
                    disabled: isDeletingProject,
                  },
                  {
                    label: "Import Cart",
                    icon: <Upload className="size-4" />,
                    onSelect: () => openCartImportPicker(project.id),
                    disabled: importCartPendingProjectId === project.id,
                  },

                  {
                    label: "Clone Project",
                    icon: <Copy className="size-4" />,
                    onSelect: () =>
                      openActionModal({
                        kind: "project-clone",
                        projectId: project.id,
                      }),
                  },
                  {
                    label: "Export Project JSON",
                    icon: <Download className="size-4" />,
                    onSelect: () => handleOpenProjectExport(project),
                  },
                  {
                    label: "Export Project Excel",
                    icon: <Download className="size-4" />,
                    onSelect: () => void handleExportProjectExcel(project),
                  },
                  ...(project.canShare
                    ? [
                        {
                          label: "Share Project",
                          icon: <Share2 className="size-4" />,
                          onSelect: () =>
                            openActionModal({
                              kind: "project-share",
                              projectId: project.id,
                            }),
                        },
                      ]
                    : []),
                ];

                return (
                  <div key={project.id} className="rounded-lg border bg-white">
                    <div className="flex items-start gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        {isEditingProject ? (
                          <div className="space-y-2 pr-2">
                            <Input
                              value={
                                projectNameDrafts[project.id] ?? project.name
                              }
                              onChange={(event) =>
                                setProjectNameDrafts((current) => ({
                                  ...current,
                                  [project.id]: event.target.value,
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void handleRenameProject(project);
                                }

                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  handleCancelProjectRename(project);
                                }
                              }}
                              autoFocus
                              placeholder="Project name"
                            />
                            <p className="text-xs text-zinc-500">
                              Press Enter to save or Escape to cancel.
                            </p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="min-w-0 text-left"
                            onClick={() => toggleProject(project.id)}
                            aria-expanded={isExpanded}
                          >
                            <p className="font-medium">{project.name}</p>
                            <p className="text-sm text-zinc-500">
                              {project.lists.length} carts ·{" "}
                              {project.lists.reduce(
                                (sum, list) => sum + list.productCount,
                                0,
                              )}{" "}
                              resources
                            </p>
                          </button>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isEditingProject ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleRenameProject(project)}
                              disabled={isRenamingProject}
                              aria-label="Save project name"
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCancelProjectRename(project)}
                              disabled={isRenamingProject}
                              aria-label="Cancel project rename"
                            >
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Add cart to ${project.name}`}
                              onClick={() =>
                                openActionModal({
                                  kind: "project-add-cart",
                                  projectId: project.id,
                                })
                              }
                              disabled={listPendingProjectId === project.id}
                            >
                              <Plus className="size-4" />
                            </Button>
                            {project.canShare ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  openActionModal({
                                    kind: "project-share",
                                    projectId: project.id,
                                  })
                                }
                                aria-label={`Share ${project.name}`}
                              >
                                <Share2 className="size-4" />
                              </Button>
                            ) : null}
                            <ActionMenu
                              open={openProjectMenuId === project.id}
                              onOpenChange={(open) =>
                                setOpenProjectMenuId(open ? project.id : null)
                              }
                              label={`Open actions for ${project.name}`}
                              items={projectMenuItems}
                            />
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleProject(project.id)}
                          aria-label={
                            isExpanded ? "Collapse project" : "Expand project"
                          }
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDeleteProject(project)}
                          disabled={isDeletingProject || isRenamingProject}
                          aria-label="Delete project"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="border-t border-zinc-100 px-3 py-3">
                        <div className="space-y-2">
                          {
                          projectCloneMessage ||
                          projectImportMessage ||
                          projectExportMessage ||
                          projectShareMessage ? (
                            <div className="rounded-lg border bg-zinc-50 p-3">
                              <div className="space-y-1 text-xs">

                                {projectCloneMessage ? (
                                  <p
                                    className={
                                      projectCloneIsError
                                        ? "text-red-600"
                                        : "text-zinc-600"
                                    }
                                  >
                                    {projectCloneMessage}
                                  </p>
                                ) : null}
                                {projectImportMessage ? (
                                  <p
                                    className={
                                      projectImportMessageIsError
                                        ? "text-red-600"
                                        : "text-zinc-600"
                                    }
                                  >
                                    {projectImportMessage}
                                  </p>
                                ) : null}
                                {projectExportMessage ? (
                                  <p
                                    className={
                                      projectExportMessageIsError
                                        ? "text-red-600"
                                        : "text-zinc-600"
                                    }
                                  >
                                    {projectExportMessage}
                                  </p>
                                ) : null}
                                {projectShareMessage ? (
                                  <p className="text-zinc-600">
                                    {projectShareMessage}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                          {project.lists.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-start gap-2 rounded-lg border p-3 ${
                                selectedListId === item.id
                                  ? "border-zinc-950 bg-white"
                                  : "border-zinc-200 bg-zinc-50"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedListId(item.id)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium">{item.name}</p>
                                    </div>
                                    <p className="text-sm text-zinc-500">
                                      {item.productCount} resources
                                    </p>
                                  </div>
                                </div>
                              </button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  void handleDeleteList(item, project.id)
                                }
                                disabled={deletingListId === item.id}
                                aria-label={`Delete ${item.name}`}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          ))}
                          {project.lists.length === 0 ? (
                            <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-500">
                              No carts yet.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
}
