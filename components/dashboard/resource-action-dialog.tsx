"use client";
import { huaweiRegions, type HuaweiRegionKey } from "@/lib/huawei-regions";
import { type BillingOption } from "@/lib/page-utils";

import { ActionModal } from "@/components/home-page-shell-parts";
import { ProjectAddCartModalContent } from "@/components/project-add-cart-modal-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCartCloneDefaultName,
  getProjectCloneDefaultName,
} from "@/lib/calculator-page-helpers";
import type { DashboardModel } from "@/lib/dashboard/use-dashboard";
import { BILLING_OPTIONS } from "@/lib/page-utils";
import { formatDateTime } from "@/lib/utils";

export function ResourceActionDialog({
  projectActions,
  huawei,
  cloning,
  sharing,
  projectStore,
  activeModal,
  setActiveModal,
}: DashboardModel["actionDialog"]) {
  const {
    listDrafts,
    setListDrafts,
    listBaseDrafts,
    setListBaseDrafts,
    listPendingProjectId,
    handleCreateList,
  } = projectActions;
  const {
    huaweiCarts,
    cookieValue,
    handleSyncProjectHuawei,
    setSelectedHuaweiCartKey,
    handleLinkSelectedList,
    projectHuaweiMessages,
    projectHuaweiMessageErrors,
    selectedHuaweiCartKey,
    huaweiActionMessage,
    syncingHuaweiProjectId,
    linkingHuaweiListId,
  } = huawei;
  const {
    projectCloneNameDrafts,
    setProjectCloneNameDrafts,
    setProjectCloneTargetRegions,
    setProjectCloneTargetBillingModes,
    handleCloneProject,
    cloneNameDraft,
    setCloneNameDraft,
    cloneTargetRegion,
    cloneTargetBillingMode,
    setCloneTargetRegion,
    setCloneTargetBillingMode,
    handleCloneSelectedList,
    projectCloneTargetRegions,
    projectCloneTargetBillingModes,
    projectCloneMessages,
    projectCloneMessageErrors,
    cloneActionMessage,
    cloneActionIsError,
    cloningProjectId,
    cloningListId,
  } = cloning;
  const {
    handleCreateShare,
    sharingProjectKey,
    sharingListKey,
    projectShareMessages,
    listShareMessages,
  } = sharing;
  const { projectsById, listsById } = projectStore;
  const activeProject =
    activeModal == null
      ? null
      : "projectId" in activeModal
        ? (projectsById.get(activeModal.projectId) ?? null)
        : (listsById.get(activeModal.listId)?.project ?? null);

  const activeList =
    activeModal != null && "listId" in activeModal
      ? (listsById.get(activeModal.listId)?.list ?? null)
      : null;

  const cloneableRegions = (
    Object.entries(huaweiRegions) as Array<
      [HuaweiRegionKey, (typeof huaweiRegions)[HuaweiRegionKey]]
    >
  ).filter(([, labels]) => Boolean(labels.catalogRegionId));

  const activeProjectCloneTargetRegion = activeProject
    ? (projectCloneTargetRegions[activeProject.id] ?? "")
    : "";

  const activeProjectCloneTargetBillingMode = activeProject
    ? (projectCloneTargetBillingModes[activeProject.id] ?? "")
    : "";

  const activeProjectCloneMessage = activeProject
    ? (projectCloneMessages[activeProject.id] ?? "")
    : "";

  const activeProjectCloneMessageIsError = activeProject
    ? (projectCloneMessageErrors[activeProject.id] ?? false)
    : false;

  const activeProjectHuaweiMessage = activeProject
    ? (projectHuaweiMessages[activeProject.id] ?? "")
    : "";

  const activeProjectHuaweiMessageIsError = activeProject
    ? (projectHuaweiMessageErrors[activeProject.id] ?? false)
    : false;

  const activeProjectShareMessage = activeProject
    ? (projectShareMessages[activeProject.id] ?? "")
    : "";

  const activeSelectedHuaweiCartKey = activeList
    ? selectedHuaweiCartKey || activeList.huaweiCartKey || ""
    : "";

  const activeSelectedHuaweiCart =
    huaweiCarts.find((cart) => cart.key === activeSelectedHuaweiCartKey) ??
    null;

  const activeListCloneMessage = activeList ? cloneActionMessage : "";

  const activeListCloneMessageIsError = activeList ? cloneActionIsError : false;

  const activeListHuaweiMessage = activeList ? huaweiActionMessage : "";

  const activeListShareMessage = activeList
    ? (listShareMessages[activeList.id] ?? "")
    : "";

  const isActiveProjectCloning = activeProject
    ? cloningProjectId === activeProject.id
    : false;

  const isActiveProjectSyncing = activeProject
    ? syncingHuaweiProjectId === activeProject.id
    : false;

  const isActiveListLinking = activeList
    ? linkingHuaweiListId === activeList.id
    : false;

  const isActiveListCloning = activeList
    ? cloningListId === activeList.id
    : false;
  return (
    <>
      {activeModal && activeProject ? (
        <ActionModal
          title={
            activeModal.kind === "project-add-cart"
              ? "Add Cart"
              : activeModal.kind === "project-huawei"
                ? "Create Huawei Carts"
                : activeModal.kind === "project-clone"
                  ? "Clone Project"
                  : activeModal.kind === "project-share"
                    ? "Share Project"
                    : activeModal.kind === "list-link"
                      ? "Link Huawei Cart"
                      : activeModal.kind === "list-clone"
                        ? "Clone Cart"
                        : "Share Cart"
          }
          description={
            activeModal.kind === "project-add-cart"
              ? "Create a new cart in this project. Optionally start from one of the imported Huawei carts."
              : activeModal.kind === "project-huawei"
                ? "Create or update one Huawei cart for every NeoCalculator cart in this project."
                : activeModal.kind === "project-clone"
                  ? "Clone every cart in this project into a new project, with optional region and billing conversion."
                  : activeModal.kind === "project-share"
                    ? "Choose whether recipients should import a detached copy or join a collaborative project."
                    : activeModal.kind === "list-link"
                      ? "Link this cart to an existing Huawei calculator cart using the saved Huawei Cloud cookie."
                      : activeModal.kind === "list-clone"
                        ? "Clone this cart with optional region and billing conversion."
                        : "Create a detached copy link or a collaborative cart link for this cart only."
          }
          onClose={() => setActiveModal(null)}
        >
          {activeModal.kind === "project-add-cart" ? (
            <ProjectAddCartModalContent
              projectId={activeProject.id}
              listName={listDrafts[activeProject.id] ?? ""}
              onListNameChange={(value) =>
                setListDrafts((current) => ({
                  ...current,
                  [activeProject.id]: value,
                }))
              }
              baseCartKey={listBaseDrafts[activeProject.id] ?? ""}
              onBaseCartKeyChange={(value) =>
                setListBaseDrafts((current) => ({
                  ...current,
                  [activeProject.id]: value,
                }))
              }
              huaweiCarts={huaweiCarts}
              cookieValue={cookieValue}
              pending={listPendingProjectId === activeProject.id}
              onSubmit={() => void handleCreateList(activeProject.id)}
            />
          ) : null}

          {activeModal.kind === "project-huawei" ? (
            <>
              {activeProjectHuaweiMessage ? (
                <p
                  className={`text-sm ${activeProjectHuaweiMessageIsError ? "text-red-600" : "text-zinc-600"}`}
                >
                  {activeProjectHuaweiMessage}
                </p>
              ) : !cookieValue.trim() ? (
                <p className="text-sm text-zinc-500">
                  Save a Huawei Cloud cookie on the dashboard to enable project
                  sync.
                </p>
              ) : (
                <p className="text-sm text-zinc-500">
                  Existing Huawei-linked carts are updated; unlinked carts will
                  create new Huawei carts.
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => void handleSyncProjectHuawei(activeProject)}
                  disabled={
                    isActiveProjectSyncing ||
                    activeProject.lists.length === 0 ||
                    !cookieValue.trim()
                  }
                >
                  {isActiveProjectSyncing
                    ? "Creating Huawei Carts..."
                    : "Create Huawei Carts"}
                </Button>
              </div>
            </>
          ) : null}

          {activeModal.kind === "project-clone" ? (
            <>
              <Input
                value={projectCloneNameDrafts[activeProject.id] ?? ""}
                onChange={(event) =>
                  setProjectCloneNameDrafts((current) => ({
                    ...current,
                    [activeProject.id]: event.target.value,
                  }))
                }
                placeholder={getProjectCloneDefaultName(
                  activeProject.name,
                  activeProjectCloneTargetRegion,
                  activeProjectCloneTargetBillingMode,
                )}
              />
              <div className="grid gap-2 md:grid-cols-2">
                <Select
                  value={activeProjectCloneTargetRegion || "__keep"}
                  onValueChange={(value) =>
                    setProjectCloneTargetRegions((current) => ({
                      ...current,
                      [activeProject.id]:
                        value && value !== "__keep"
                          ? (value as HuaweiRegionKey)
                          : "",
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue>
                      {activeProjectCloneTargetRegion
                        ? `Region: ${huaweiRegions[activeProjectCloneTargetRegion].short}`
                        : "Keep current region"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep">Keep current region</SelectItem>
                    {cloneableRegions.map(([value, labels]) => (
                      <SelectItem key={value} value={value}>
                        {labels.short}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={activeProjectCloneTargetBillingMode || "__keep"}
                  onValueChange={(value) =>
                    setProjectCloneTargetBillingModes((current) => ({
                      ...current,
                      [activeProject.id]:
                        value && value !== "__keep"
                          ? (value as BillingOption)
                          : "",
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue>
                      {activeProjectCloneTargetBillingMode
                        ? `Billing: ${activeProjectCloneTargetBillingMode}`
                        : "Keep current billing"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep">Keep current billing</SelectItem>
                    {BILLING_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeProjectCloneMessage ? (
                <p
                  className={`text-sm ${activeProjectCloneMessageIsError ? "text-red-600" : "text-zinc-600"}`}
                >
                  {activeProjectCloneMessage}
                </p>
              ) : (
                <p className="text-sm text-zinc-500">
                  Huawei links are not copied to the cloned project.
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => void handleCloneProject(activeProject)}
                  disabled={isActiveProjectCloning}
                >
                  {isActiveProjectCloning
                    ? "Cloning Project..."
                    : "Clone Project"}
                </Button>
              </div>
            </>
          ) : null}

          {activeModal.kind === "project-share" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    void handleCreateShare("project", activeProject.id, "copy")
                  }
                  disabled={
                    sharingProjectKey === `project:${activeProject.id}:copy`
                  }
                >
                  {sharingProjectKey === `project:${activeProject.id}:copy`
                    ? "Sharing..."
                    : "Copy Link"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    void handleCreateShare(
                      "project",
                      activeProject.id,
                      "collaborate",
                    )
                  }
                  disabled={
                    sharingProjectKey ===
                    `project:${activeProject.id}:collaborate`
                  }
                >
                  {sharingProjectKey ===
                  `project:${activeProject.id}:collaborate`
                    ? "Sharing..."
                    : "Collaborative Link"}
                </Button>
              </div>
              {activeProjectShareMessage ? (
                <p className="text-sm text-zinc-600">
                  {activeProjectShareMessage}
                </p>
              ) : null}
            </>
          ) : null}

          {activeList && activeModal.kind === "list-link" ? (
            <>
              {activeList.huaweiCartKey ? (
                <p className="text-sm text-zinc-600">
                  Linked to{" "}
                  {activeList.huaweiCartName || activeList.huaweiCartKey}
                </p>
              ) : null}
              {activeList.huaweiLastSyncedAt ? (
                <p className="text-sm text-zinc-500">
                  Last Huawei sync:{" "}
                  {formatDateTime(activeList.huaweiLastSyncedAt)}
                </p>
              ) : null}
              {activeList.huaweiLastError ? (
                <p className="text-sm text-red-600">
                  {activeList.huaweiLastError}
                </p>
              ) : null}
              {activeListHuaweiMessage ? (
                <p className="text-sm text-zinc-600">
                  {activeListHuaweiMessage}
                </p>
              ) : !cookieValue.trim() ? (
                <p className="text-sm text-zinc-500">
                  Save a Huawei Cloud cookie on the dashboard to load linkable
                  carts here.
                </p>
              ) : null}
              <Select
                value={activeSelectedHuaweiCartKey || "__unlinked"}
                onValueChange={(value) =>
                  setSelectedHuaweiCartKey(
                    value && value !== "__unlinked" ? value : "",
                  )
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue>
                    {activeSelectedHuaweiCartKey
                      ? `Huawei: ${activeSelectedHuaweiCart?.name ?? activeList.huaweiCartName ?? activeSelectedHuaweiCartKey}`
                      : "Choose Huawei cart to link"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unlinked">
                    No Huawei link selected
                  </SelectItem>
                  {activeList.huaweiCartKey &&
                  !huaweiCarts.some(
                    (cart) => cart.key === activeList.huaweiCartKey,
                  ) ? (
                    <SelectItem value={activeList.huaweiCartKey}>
                      {activeList.huaweiCartName ?? activeList.huaweiCartKey}
                    </SelectItem>
                  ) : null}
                  {huaweiCarts.map((cart) => {
                    const linkedElsewhere = Boolean(
                      cart.associatedListId &&
                      cart.associatedListId !== activeList.id,
                    );
                    return (
                      <SelectItem
                        key={cart.key}
                        value={cart.key}
                        disabled={linkedElsewhere}
                      >
                        {cart.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={handleLinkSelectedList}
                  disabled={!activeSelectedHuaweiCartKey || isActiveListLinking}
                >
                  {isActiveListLinking ? "Linking..." : "Link Huawei Cart"}
                </Button>
              </div>
            </>
          ) : null}

          {activeList && activeModal.kind === "list-clone" ? (
            <>
              <Input
                value={cloneNameDraft}
                onChange={(event) => setCloneNameDraft(event.target.value)}
                placeholder={getCartCloneDefaultName(
                  activeList.name,
                  cloneTargetRegion,
                  cloneTargetBillingMode,
                )}
              />
              <div className="grid gap-2 md:grid-cols-2">
                <Select
                  value={cloneTargetRegion || "__keep"}
                  onValueChange={(value) =>
                    setCloneTargetRegion(
                      value && value !== "__keep"
                        ? (value as HuaweiRegionKey)
                        : "",
                    )
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue>
                      {cloneTargetRegion
                        ? `Region: ${huaweiRegions[cloneTargetRegion].short}`
                        : "Keep current region"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep">Keep current region</SelectItem>
                    {cloneableRegions.map(([value, labels]) => (
                      <SelectItem key={value} value={value}>
                        {labels.short}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={cloneTargetBillingMode || "__keep"}
                  onValueChange={(value) =>
                    setCloneTargetBillingMode(
                      value && value !== "__keep"
                        ? (value as BillingOption)
                        : "",
                    )
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue>
                      {cloneTargetBillingMode
                        ? `Billing: ${cloneTargetBillingMode}`
                        : "Keep current billing"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep">Keep current billing</SelectItem>
                    {BILLING_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeListCloneMessage ? (
                <p
                  className={`text-sm ${activeListCloneMessageIsError ? "text-red-600" : "text-zinc-600"}`}
                >
                  {activeListCloneMessage}
                </p>
              ) : (
                <p className="text-sm text-zinc-500">
                  ECS items are reselected by the cheapest flavor that meets or
                  exceeds the current vCPU and RAM.
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={handleCloneSelectedList}
                  disabled={isActiveListCloning}
                >
                  {isActiveListCloning ? "Cloning..." : "Clone Cart"}
                </Button>
              </div>
            </>
          ) : null}

          {activeList && activeModal.kind === "list-share" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    void handleCreateShare("list", activeList.id, "copy")
                  }
                  disabled={sharingListKey === `list:${activeList.id}:copy`}
                >
                  {sharingListKey === `list:${activeList.id}:copy`
                    ? "Sharing..."
                    : "Copy Link"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    void handleCreateShare("list", activeList.id, "collaborate")
                  }
                  disabled={
                    sharingListKey === `list:${activeList.id}:collaborate`
                  }
                >
                  {sharingListKey === `list:${activeList.id}:collaborate`
                    ? "Sharing..."
                    : "Collaborative Link"}
                </Button>
              </div>
              {activeListShareMessage ? (
                <p className="text-sm text-zinc-600">
                  {activeListShareMessage}
                </p>
              ) : null}
            </>
          ) : null}
        </ActionModal>
      ) : null}
    </>
  );
}
