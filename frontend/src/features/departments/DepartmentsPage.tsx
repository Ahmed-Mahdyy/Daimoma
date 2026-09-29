import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createDepartment,
  listDepartments,
  updateDepartment,
} from "../../api/departments";
import { Alert } from "../../components/ui/Alert";
import { AsyncState } from "../../components/ui/AsyncState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

const input = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";

/** HR department management: add/rename/deactivate — never delete, so
 * member history stays intact. */
export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["departments"] });

  const createMutation = useMutation({
    mutationFn: () => createDepartment(newName.trim()),
    onSuccess: () => {
      setNewName("");
      setNotice("Department created.");
      void invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed."),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; name?: string; is_active?: boolean }) =>
      updateDepartment(input.id, { name: input.name, is_active: input.is_active }),
    onSuccess: () => {
      setRenaming(null);
      setDeactivating(null);
      setNotice("Department updated.");
      void invalidate();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed."),
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold">Departments</h1>
      <p className="mt-1 text-sm text-gray-600">
        Deactivated departments keep their history; members become unassigned.
      </p>

      {error && <div className="mt-3"><Alert kind="error">{error}</Alert></div>}
      {notice && <div className="mt-3"><Alert kind="success">{notice}</Alert></div>}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setNotice(null);
          if (newName.trim()) createMutation.mutate();
        }}
      >
        <input
          aria-label="New department name"
          placeholder="New department name"
          className={input}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !newName.trim()}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          Add
        </button>
      </form>

      <AsyncState isLoading={isLoading} error={loadError} isEmpty={data?.results.length === 0} emptyText="No departments yet.">
        <ul className="mt-4 divide-y rounded-lg border bg-white">
          {data?.results.map((d) => (
            <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              {renaming === d.id ? (
                <>
                  <input
                    aria-label={`Rename ${d.name}`}
                    className={input}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                  />
                  <button
                    type="button"
                    className="text-brand-700 underline"
                    onClick={() =>
                      updateMutation.mutate({ id: d.id, name: renameValue.trim() })
                    }
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="text-gray-600 underline"
                    onClick={() => setRenaming(null)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className={d.is_active ? "" : "text-gray-400 line-through"}>
                    {d.name}
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    className="text-brand-700 underline"
                    onClick={() => {
                      setRenaming(d.id);
                      setRenameValue(d.name);
                    }}
                  >
                    Rename
                  </button>
                  {d.is_active ? (
                    <button
                      type="button"
                      className="text-red-700 underline"
                      onClick={() => setDeactivating(d.id)}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-green-700 underline"
                      onClick={() =>
                        updateMutation.mutate({ id: d.id, is_active: true })
                      }
                    >
                      Reactivate
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </AsyncState>

      <ConfirmDialog
        open={deactivating !== null}
        danger
        title="Deactivate department?"
        body="Members of this department become unassigned. The department and its history are preserved."
        confirmLabel="Deactivate"
        onConfirm={() =>
          deactivating &&
          updateMutation.mutate({ id: deactivating, is_active: false })
        }
        onCancel={() => setDeactivating(null)}
      />
    </div>
  );
}
