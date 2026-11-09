import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowRight,
  ImagePlus,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { api, type EventDraft } from "../../api";
import type { Event } from "../../types";
import { Modal, PageHead } from "../../shared/components/ui";

export function AdminEvents({ toast }: { toast: (s: string) => void }) {
  const [list, setList] = useState<Event[]>([]);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Technical");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState(100);
  const [participationType, setParticipationType] =
    useState<EventDraft["participationType"]>("individual");
  const [teamMin, setTeamMin] = useState(2);
  const [teamMax, setTeamMax] = useState(5);
  const [teamLeaderIncluded, setTeamLeaderIncluded] = useState(true);
  const [imagePreview, setImagePreview] = useState("");
  const [imagePublicId, setImagePublicId] = useState("");
  const [existingImageId, setExistingImageId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removeImageRequested, setRemoveImageRequested] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const resetImageState = (preview = "", publicId = "") => {
    setImagePreview(preview);
    setImagePublicId(publicId);
    setExistingImageId(publicId);
    setImageFile(null);
    setUploadingImage(false);
    setRemoveImageRequested(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };
  const pickImageFile = (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Event images must be 5 MB or smaller.");
      return;
    }
    setError("");
    // Preview locally first; the file only reaches Cloudinary on publish.
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImagePublicId("");
    setRemoveImageRequested(false);
  };
  useEffect(() => {
    void api
      .events()
      .then(setList)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load events.",
        ),
      );
  }, []);
  return (
    <>
      <PageHead
        eyebrow="MAKE IT HAPPEN"
        title="Events"
        description="Create the moments your campus will remember."
        action={
          <button
            className="btn btn-dark"
            onClick={() => {
              setEditingId(null);
              setError("");
              setParticipationType("individual");
              setTeamMin(2);
              setTeamMax(5);
              setTeamLeaderIncluded(true);
              resetImageState();
              setModal(true);
            }}
          >
            <Plus size={16} /> Create event
          </button>
        }
      />
      <div className="admin-list">
        {list.map((e) => (
          <div className="admin-event-row" key={e.id}>
            <img src={e.image || undefined} />
            <span>
              <b>{e.title}</b>
              <small>
                {e.category} · {e.date} · {e.venue}
              </small>
            </span>
            <span className="admin-event-count">
              {e.registered} <small>/ {e.maxParticipants} registered</small>
            </span>
            <span className="status-badge">
              <i /> {e.status.toUpperCase()}
            </span>
            <button
              className="icon-button"
              aria-label="Edit event"
              onClick={() => {
                setError("");
                void api
                  .eventRecord(e.id)
                  .then((record) => {
                    setEditingId(e.id);
                    setName(record.title);
                    setCategory(record.category);
                    setDescription(record.description);
                    setVenue(record.venue);
                    const localDate = (value: string) => {
                      const date = new Date(value);
                      date.setMinutes(
                        date.getMinutes() - date.getTimezoneOffset(),
                      );
                      return date.toISOString().slice(0, 16);
                    };
                    setStartsAt(localDate(record.startsAt));
                    setEndsAt(localDate(record.endsAt));
                    setCapacity(record.capacity);
                    setParticipationType(
                      record.participationType || "individual",
                    );
                    setTeamMin(record.teamMin ?? 2);
                    setTeamMax(record.teamMax ?? 5);
                    setTeamLeaderIncluded(record.teamLeaderIncluded ?? true);
                    resetImageState(
                      record.image || "",
                      record.imagePublicId || "",
                    );
                    setModal(true);
                  })
                  .catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not load event.",
                    ),
                  );
              }}
            >
              <Settings size={16} />
            </button>
            {!["cancelled", "archived", "ended"].includes(e.status) && (
              <button
                className="icon-button"
                aria-label="Cancel event"
                onClick={() =>
                  void api
                    .cancelEvent(e.id)
                    .then((event) => {
                      setList((current) =>
                        current.map((item) =>
                          item.id === event.id ? event : item,
                        ),
                      );
                      toast("Event cancelled");
                    })
                    .catch((cause: unknown) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not cancel event.",
                      ),
                    )
                }
              >
                <X size={16} />
              </button>
            )}
            {["cancelled", "ended"].includes(e.status) && (
              <button
                className="icon-button"
                aria-label="Archive event"
                onClick={() =>
                  void api
                    .archiveEvent(e.id)
                    .then((event) => {
                      setList((current) =>
                        current.map((item) =>
                          item.id === event.id ? event : item,
                        ),
                      );
                      toast("Event archived");
                    })
                    .catch((cause: unknown) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not archive event.",
                      ),
                    )
                }
              >
                <Archive size={16} />
              </button>
            )}
            {!["archived", "ended"].includes(e.status) && (
              <button
                className="icon-button"
                aria-label="Delete event"
                title="Delete event (removes its Cloudinary image too)"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Delete “${e.title}”? Its image will also be removed from Cloudinary.`,
                    )
                  )
                    return;
                  void api
                    .deleteEvent(e.id)
                    .then(() => {
                      setList((current) =>
                        current.filter((item) => item.id !== e.id),
                      );
                      toast("Event deleted");
                    })
                    .catch((cause: unknown) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not delete event.",
                      ),
                    );
                }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {modal && (
        <Modal
          title={editingId ? "Edit event" : "Create an event"}
          close={() => {
            // If a new poster was already uploaded to Cloudinary but the
            // event was never saved with it, clean the orphan asset up now.
            if (imagePublicId && imagePublicId !== existingImageId)
              void api.deleteEventImage(imagePublicId).catch(() => {});
            resetImageState();
            setModal(false);
            setEditingId(null);
          }}
        >
          <label>
            Event name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. The Big Idea"
            />
          </label>
          <div className="event-image-box">
            <span className="event-image-label">Event image</span>
            {!removeImageRequested && (imageFile || imagePreview) ? (
              <div className="event-image-preview">
                <img src={imagePreview} alt="Event image preview" />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={uploadingImage}
                  onClick={() => {
                    // Uploaded for this unsaved session? Remove it from Cloudinary too.
                    if (imagePublicId && imagePublicId !== existingImageId)
                      void api.deleteEventImage(imagePublicId).catch(() => {});
                    setImageFile(null);
                    setImagePreview("");
                    setImagePublicId("");
                    if (imageInputRef.current) imageInputRef.current.value = "";
                  }}
                >
                  Remove preview
                </button>
              </div>
            ) : !removeImageRequested && existingImageId ? (
              <div className="event-image-preview">
                <img src={imagePreview} alt="Current event image" />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setRemoveImageRequested(true)}
                >
                  Remove current image
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="event-image-select"
                disabled={uploadingImage}
                onClick={() => imageInputRef.current?.click()}
              >
                <ImagePlus size={20} />
                <span>
                  {removeImageRequested
                    ? "Image will be removed · click to choose another"
                    : "Click to select an event image (JPG, PNG or WebP, up to 5 MB)"}
                </span>
              </button>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => pickImageFile(e.target.files?.[0])}
            />
          </div>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>Technical</option>
              <option>Music</option>
              <option>Creative</option>
            </select>
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will guests experience?"
            />
          </label>
          <label>
            Venue
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              required
              placeholder="Main Auditorium"
            />
          </label>
          <label>
            Starts
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </label>
          <label>
            Ends
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
          </label>
          <label>
            Capacity
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Participation type
            <select
              value={participationType}
              onChange={(e) =>
                setParticipationType(
                  e.target.value as EventDraft["participationType"],
                )
              }
            >
              <option value="individual">Individual / Solo</option>
              <option value="team">Team</option>
              <option value="both">Individual and Team</option>
            </select>
          </label>
          {participationType !== "individual" && (
            <>
              <label>
                Minimum team size
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={teamMin}
                  onChange={(e) => setTeamMin(Number(e.target.value))}
                />
              </label>
              <label>
                Maximum team size
                <input
                  type="number"
                  min={teamMin}
                  max={20}
                  value={teamMax}
                  onChange={(e) => setTeamMax(Number(e.target.value))}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={teamLeaderIncluded}
                  onChange={(e) => setTeamLeaderIncluded(e.target.checked)}
                />
                Count the team leader in the team size
              </label>
            </>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button
              className="btn btn-dark"
              disabled={
                saving ||
                (participationType !== "individual" &&
                  (teamMin < 2 || teamMax < teamMin)) ||
                !name.trim() ||
                !description.trim() ||
                !venue.trim() ||
                !startsAt ||
                !endsAt
              }
              onClick={() => {
                setSaving(true);
                setError("");
                const payload: EventDraft = {
                  title: name.trim(),
                  category,
                  description: description.trim(),
                  venue: venue.trim(),
                  startsAt: new Date(startsAt).toISOString(),
                  endsAt: new Date(endsAt).toISOString(),
                  capacity,
                  participationType,
                  teamMin: participationType === "individual" ? 1 : teamMin,
                  teamMax: participationType === "individual" ? 1 : teamMax,
                  teamLeaderIncluded,
                };
                // Image flow: the poster is previewed locally first and only
                // pushed to Cloudinary when the admin publishes. If the save
                // fails afterwards the fresh upload is deleted so no orphan
                // image lingers in Cloudinary.
                const withImage = async (): Promise<EventDraft> => {
                  if (imageFile) {
                    setUploadingImage(true);
                    const uploaded = await api.uploadEventImage(imageFile);
                    setImagePreview(uploaded.url);
                    setImagePublicId(uploaded.publicId);
                    return {
                      ...payload,
                      image: uploaded.url,
                      imagePublicId: uploaded.publicId,
                    };
                  }
                  if (imagePublicId)
                    return { ...payload, image: imagePreview, imagePublicId };
                  if (removeImageRequested && existingImageId)
                    return { ...payload, image: "", imagePublicId: "" };
                  return payload;
                };
                const run = async () => {
                  const finalPayload = await withImage();
                  try {
                    return editingId
                      ? await api.updateEvent(editingId, finalPayload)
                      : await api
                          .createEvent(finalPayload)
                          .then((draft) => api.publishEvent(draft.id));
                  } catch (cause) {
                    const freshId =
                      finalPayload.imagePublicId &&
                      finalPayload.imagePublicId !== existingImageId
                        ? finalPayload.imagePublicId
                        : "";
                    if (freshId)
                      await api.deleteEventImage(freshId).catch(() => {});
                    throw cause;
                  } finally {
                    setUploadingImage(false);
                  }
                };
                void run()
                  .then((saved) => {
                    setList((current) =>
                      editingId
                        ? current.map((event) =>
                            event.id === saved.id ? saved : event,
                          )
                        : [saved, ...current],
                    );
                    setModal(false);
                    setEditingId(null);
                    setName("");
                    setDescription("");
                    setVenue("");
                    setStartsAt("");
                    setEndsAt("");
                    resetImageState();
                    toast("Event published");
                  })
                  .catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not create event.",
                    ),
                  )
                  .finally(() => setSaving(false));
              }}
            >
              {saving ? "Saving…" : "Publish event"} <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
