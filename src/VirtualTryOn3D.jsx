import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Expand,
  Eye,
  Heart,
  Image as ImageIcon,
  Layers3,
  LockKeyhole,
  Maximize2,
  RefreshCw,
  Ruler,
  Share2,
  ShoppingBag,
  Sparkles,
  Video,
  X
} from "lucide-react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { colorFromName, createVirtualTryOnRenderer } from "./virtualTryOn3D.js";
import { coverLandmarks, poseFromLandmarks as resolveFacePose, createCameraSession, stopMediaStream } from "./tryOnPose.js";
import "./styles/try-on-refinements.css";
import LunaTryOnGuide from "./LunaTryOnGuide.jsx";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/models/face_landmarker.task";
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const money = (value) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value || 0));
const optionLabels = {
  Black: "E zezë",
  Smoke: "Tymi",
  Clear: "E tejdukshme",
  Graphite: "Grafit",
  Champagne: "Shampanjë",
  Amber: "Qelibar",
  Green: "E gjelbër",
  Gold: "Ar",
  Silver: "Argjend",
  Bronze: "Bronz",
  "Black gold": "E zezë me ar",
  "Chrome clear": "Krom e tejdukshme",
  "Matte black": "E zezë mat",
  "Gradient smoke": "Tymi gradient",
  "Mirror gold": "Ar pasqyrë",
  "Honey gradient": "Mjaltë gradient",
  "Brown gradient": "Kafe gradient",
  "Mineral green": "E gjelbër minerale",
  "Neutral smoke": "Tymi neutral",
  "Warm amber": "Qelibar i ngrohtë",
  "Deep grey": "Gri e thellë",
  "Blue-reflect": "Reflektim blu",
  "Blue mirror": "Blu pasqyrë",
  "Olive gradient": "Ulliri gradient",
  "Photochromic grey": "Gri fotokromatike",
  "Mirror silver": "Argjend pasqyrë"
};
const optionLabel = (value) => optionLabels[value] || value;

const statusCopy = {
  idle: ["Gati", "Zgjidhni mënyrën e provës."],
  consent: ["Kamera është e fikur", "Lejojeni vetëm kur të jeni gati."],
  loading: ["Duke u përgatitur", "Po ngarkohet gjurmimi 3D në pajisjen tuaj."],
  permission: ["Po pret lejen", "Konfirmoni kamerën në shfletues."],
  stable: ["Gjurmim i qëndrueshëm", "Korniza po ndjek lëvizjen e kokës."],
  no_face: ["Fytyra nuk u gjet", "Qëndroni përballë kamerës dhe brenda udhëzuesit."],
  multiple: ["U gjetën disa fytyra", "Në kornizë duhet të jetë vetëm një person."],
  too_close: ["Shumë afër", "Largohuni pak nga kamera."],
  too_far: ["Shumë larg", "Afrohuni pak drejt kamerës."],
  low_light: ["Dritë e dobët", "Kthehuni drejt një dritareje ose ndizni dritën."],
  denied: ["Kamera u bllokua", "Lejojeni në cilësimet e shfletuesit ose përdorni një foto."],
  unsupported: ["Pajisja nuk mbështetet", "Përdorni fotografinë ose pamjen e produktit në 3D."],
  lost: ["Gjurmimi humbi", "Kthehuni ngadalë në qendër të kamerës."],
  photo_ready: ["Foto e analizuar", "Korniza u vendos automatikisht; mund ta rregulloni."],
  photo_error: ["Fytyra nuk u gjet", "Ngarkoni një foto të qartë, pa syze dhe me dritë të mirë."],
  viewer: ["Pamje interaktive 3D", "Tërhiqeni për ta rrotulluar; 0 e kthen përballë."],
  error: ["Nuk u hap prova", "Provoni përsëri ose vazhdoni me modalitetin pa kamerë."]
};

const photoAngleOptions = [
  { id: "front", label: "Përballë", shortLabel: "Para" },
  { id: "left", label: "Profili majtas", shortLabel: "Majtas" },
  { id: "right", label: "Profili djathtas", shortLabel: "Djathtas" }
];

function mapLandmarksToCover(points, source, stage) {
  const sourceWidth = source?.videoWidth || source?.naturalWidth || source?.width;
  const sourceHeight = source?.videoHeight || source?.naturalHeight || source?.height;
  const stageWidth = stage?.clientWidth;
  const stageHeight = stage?.clientHeight;
  return coverLandmarks(points, sourceWidth, sourceHeight, stageWidth, stageHeight);
}

function drawCover(context, source, width, height, mirror = false) {
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height;
  if (!sourceWidth || !sourceHeight) return;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  context.save();
  if (mirror) {
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(source, -x - drawWidth, y, drawWidth, drawHeight);
  } else {
    context.drawImage(source, x, y, drawWidth, drawHeight);
  }
  context.restore();
}

export default function VirtualTryOn3D({
  sunglasses,
  activeProduct,
  setSelectedId,
  navigate,
  openMeasurement,
  addToCart,
  wishlist,
  toggleWishlist,
  compare,
  toggleCompare,
  trackEvent
}) {
  const stageRef = useRef(null);
  const configRef = useRef(null);
  const renderHostRef = useRef(null);
  const engineRef = useRef(null);
  const videoRef = useRef(null);
  const photoRef = useRef(null);
  const photoInputRef = useRef(null);
  const photoTargetRef = useRef("front");
  const streamRef = useRef(null);
  const trackerRef = useRef(null);
  const trackerModeRef = useRef("");
  const trackingFrameRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastAnalysisTimeRef = useRef(0);
  const manualRef = useRef({ scale: 1, vertical: 0, horizontal: 0, rotation: 0 });
  const cameraFacingRef = useRef("user");
  const lightCanvasRef = useRef(null);
  const lastLightCheckRef = useRef(0);
  const draggingRef = useRef(null);
  const faceTrackedRef = useRef(false);
  const mountedRef = useRef(true);
  const cameraSessionRef = useRef(createCameraSession());
  const trackerQueueRef = useRef(Promise.resolve());
  const photoRevisionRef = useRef(0);
  const photoResultRef = useRef(null);
  const processResultsRef = useRef(null);
  const modeRef = useRef("live");
  const sectionRef = useRef(null);

  const [mode, setMode] = useState("live");
  const [cameraConsent, setCameraConsent] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [status, setStatus] = useState("consent");
  const [detail, setDetail] = useState("");
  const [photoViews, setPhotoViews] = useState({ front: "", left: "", right: "" });
  const [activePhotoView, setActivePhotoView] = useState("front");
  const [frameColor, setFrameColor] = useState(activeProduct?.colors?.[0] || activeProduct?.color || "Black");
  const [lensColor, setLensColor] = useState(activeProduct?.lensColors?.[0] || activeProduct?.lensColor || "Smoke");
  const [lensOpacity, setLensOpacity] = useState(64);
  const [manualScale, setManualScale] = useState(100);
  const [manualVertical, setManualVertical] = useState(0);
  const [manualHorizontal, setManualHorizontal] = useState(0);
  const [manualRotation, setManualRotation] = useState(0);
  const [cameraFacing, setCameraFacing] = useState("user");
  const [viewerRotation, setViewerRotation] = useState({ yaw: 0, pitch: 0 });
  const [viewerZoom, setViewerZoom] = useState(100);
  const [fitGuidance, setFitGuidance] = useState("Pritet analiza e fytyrës");
  const [captures, setCaptures] = useState([]);
  const [shareNotice, setShareNotice] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const [rendererError, setRendererError] = useState(false);
  const [modelSource, setModelSource] = useState("approximation");
  const photoData = photoViews[activePhotoView] || "";

  const statusMessage = statusCopy[status] || statusCopy.error;
  const colors = activeProduct?.colors?.length ? activeProduct.colors : [activeProduct?.color || "Black"];
  const lensOptions = activeProduct?.lensColors?.length ? activeProduct.lensColors : [activeProduct?.lensColor || "Smoke"];
  const selectedPrice = activeProduct?.salePrice || activeProduct?.price || 0;
  const availableCount = sunglasses.filter((product) => Number(product.stock || 0) > 0).length;
  const cameraPending = status === "loading" || status === "permission";
  const canCapture = !rendererError && (mode === "viewer" || (mode === "photo" && status === "photo_ready") || (cameraActive && ["stable", "too_close", "too_far", "low_light"].includes(status)));

  useEffect(() => {
    trackEvent?.("vto_opened", { item_id: activeProduct?.id });
    return () => trackEvent?.("vto_completed", { item_id: activeProduct?.id });
  }, []);

  useEffect(() => {
    manualRef.current = {
      scale: manualScale / 100,
      vertical: manualVertical / 100,
      horizontal: manualHorizontal / 100,
      rotation: manualRotation
    };
    if (modeRef.current === "photo" && photoResultRef.current) processResultsRef.current?.(photoResultRef.current, false, "photo");
  }, [manualScale, manualVertical, manualHorizontal, manualRotation]);

  useEffect(() => {
    if (!renderHostRef.current || !activeProduct) return undefined;
    let engine;
    try {
      engine = createVirtualTryOnRenderer(renderHostRef.current, activeProduct, {
        frameColor, lensColor, lensOpacity,
        onModelSource: (source) => { if (mountedRef.current) setModelSource(source); },
        onContextLost: () => { if (mountedRef.current) { setRendererError(true); stopCamera(); } },
        onContextRestored: () => { if (mountedRef.current) setRendererError(false); },
      });
    } catch {
      setRendererError(true);
      setStatus("unsupported");
      return undefined;
    }
    engineRef.current = engine;
    engine.setMode(mode === "viewer" ? "viewer" : mode);
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!activeProduct || !engineRef.current) return;
    setFrameColor(activeProduct.colors?.[0] || activeProduct.color || "Black");
    setLensColor(activeProduct.lensColors?.[0] || activeProduct.lensColor || "Smoke");
    setLensOpacity(activeProduct.lensType === "Clear" ? 25 : 64);
    setFitGuidance(mode === "viewer" ? "Pamje e qendërzuar · rrotullojeni modelin" : "Pritet analiza e fytyrës");
  }, [activeProduct?.id]);

  useEffect(() => {
    const panel = configRef.current;
    if (!panel) return undefined;

    panel.scrollTo({ top: 0, behavior: "auto" });
    const frame = requestAnimationFrame(() => panel.scrollTo({ top: 0, behavior: "auto" }));
    return () => cancelAnimationFrame(frame);
  }, [activeProduct?.id]);

  useEffect(() => {
    engineRef.current?.updateProduct(activeProduct, {
      frameColor, lensColor, lensOpacity,
      // A perspective catalogue cutout is not a front-facing 3D scan. Never
      // paste its already photographed arms onto a second pair of 3D temples.
      preferPhotoReconstruction: false
    });
  }, [activeProduct, frameColor, lensColor, lensOpacity, mode]);

  useEffect(() => {
    engineRef.current?.setViewerRotation(viewerRotation.yaw, viewerRotation.pitch);
    engineRef.current?.setViewerZoom(viewerZoom / 100);
  }, [viewerRotation, viewerZoom]);

  const stopCamera = () => {
    cameraSessionRef.current.cancel();
    cancelAnimationFrame(trackingFrameRef.current);
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mountedRef.current) setCameraActive(false);
    lastVideoTimeRef.current = -1;
    lastAnalysisTimeRef.current = 0;
    engineRef.current?.setFacePose(null);
  };

  useEffect(() => {
    mountedRef.current = true;
    const onHidden = () => {
      if (document.hidden && (streamRef.current || modeRef.current === "live")) {
        stopCamera();
        setStatus("consent");
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      mountedRef.current = false;
      photoRevisionRef.current += 1;
      stopCamera();
      trackerRef.current?.close?.();
      trackerRef.current = null;
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, []);

  const ensureTracker = (runningMode) => {
    const task = trackerQueueRef.current.catch(() => {}).then(async () => {
    if (!mountedRef.current) throw new Error("Session closed");
    if (!trackerRef.current) {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      const create = (delegate) => FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate },
        runningMode,
        numFaces: 2,
        minFaceDetectionConfidence: 0.62,
        minFacePresenceConfidence: 0.62,
        minTrackingConfidence: 0.58,
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false
      });
      let tracker;
      try { tracker = await create("GPU"); }
      catch { tracker = await create("CPU"); }
      if (!mountedRef.current) { tracker.close(); throw new Error("Session closed"); }
      trackerRef.current = tracker;
      trackerModeRef.current = runningMode;
    } else if (trackerModeRef.current !== runningMode) {
      await trackerRef.current.setOptions({ runningMode });
      trackerModeRef.current = runningMode;
    }
    return trackerRef.current;
    });
    trackerQueueRef.current = task;
    return task;
  };

  const updateFitGuidance = (pose) => {
    if (!pose || !activeProduct?.frameWidth) return;
    setFitGuidance("Pozicionim vizual · masa konfirmohet me optikun");
  };

  const estimateLight = (video, now) => {
    if (now - lastLightCheckRef.current < 550) return null;
    lastLightCheckRef.current = now;
    if (!lightCanvasRef.current) {
      lightCanvasRef.current = document.createElement("canvas");
      lightCanvasRef.current.width = 24;
      lightCanvasRef.current.height = 18;
    }
    const canvas = lightCanvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0;
    for (let index = 0; index < pixels.length; index += 16) total += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
    return total / Math.max(1, pixels.length / 16);
  };

  const processResults = (result, mirror = false, currentMode = modeRef.current) => {
    const faces = result?.faceLandmarks || [];
    if (!faces.length) {
      engineRef.current?.setFacePose(null);
      setStatus((current) => current === "stable" ? "lost" : "no_face");
      return null;
    }
    if (faces.length > 1) {
      engineRef.current?.setFacePose(null);
      setStatus("multiple");
      return null;
    }
    const source = currentMode === "live" ? videoRef.current : photoRef.current;
    const mappedLandmarks = mapLandmarksToCover(faces[0], source, stageRef.current);
    const matrixData = result?.facialTransformationMatrixes?.[0]?.data || null;
    const pose = resolveFacePose(mappedLandmarks, { mirror, manual: manualRef.current, matrix: matrixData, aspect: (stageRef.current?.clientWidth || 1) / (stageRef.current?.clientHeight || 1), product: activeProduct });
    if (!pose) {
      engineRef.current?.setFacePose(null);
      setStatus("no_face");
      return null;
    }
    if (currentMode === "photo") setStatus("photo_ready");
    else if (pose.eyeDistance > 0.34) setStatus("too_close");
    else if (pose.eyeDistance < 0.135) setStatus("too_far");
    else setStatus("stable");
    engineRef.current?.setFacePose(pose);
    if (!faceTrackedRef.current) {
      faceTrackedRef.current = true;
      trackEvent?.("vto_face_detected", { item_id: activeProduct?.id, mode });
    }
    updateFitGuidance(pose);
    return pose;
  };
  processResultsRef.current = processResults;

  useEffect(() => {
    if (!stageRef.current) return undefined;
    const observer = new ResizeObserver(() => {
      if (modeRef.current === "photo" && photoResultRef.current) processResultsRef.current?.(photoResultRef.current, false, "photo");
    });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  const runVideoTracking = async () => {
    const video = videoRef.current;
    const tracker = trackerRef.current;
    if (!video || !tracker || !streamRef.current) return;
    const now = performance.now();
    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current && now - lastAnalysisTimeRef.current >= 1000 / 30) {
      lastVideoTimeRef.current = video.currentTime;
      lastAnalysisTimeRef.current = now;
      try {
        const result = tracker.detectForVideo(video, now);
        const pose = processResultsRef.current?.(result, cameraFacingRef.current === "user", "live");
        const light = estimateLight(video, now);
        if (pose && light !== null && light < 46) setStatus("low_light");
      } catch {
        engineRef.current?.setFacePose(null);
        setStatus("lost");
      }
    }
    if (streamRef.current && mountedRef.current && modeRef.current === "live") trackingFrameRef.current = requestAnimationFrame(runVideoTracking);
  };

  const startCamera = async (facing = cameraFacingRef.current) => {
    if (rendererError || !engineRef.current || !navigator.mediaDevices?.getUserMedia || !window.WebGLRenderingContext) {
      setStatus("unsupported");
      return;
    }
    setCameraConsent(true);
    setStatus("loading");
    setDetail("");
    stopCamera();
    const session = cameraSessionRef.current.begin();
    try {
      await ensureTracker("VIDEO");
      if (!cameraSessionRef.current.current(session) || !mountedRef.current || modeRef.current !== "live") return;
      setStatus("permission");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
        audio: false
      });
      if (!cameraSessionRef.current.accept(session, stream)) return;
      cameraFacingRef.current = facing;
      setCameraFacing(facing);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (!cameraSessionRef.current.current(session)) { stopMediaStream(stream); return; }
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", () => {
        if (cameraSessionRef.current.current(session)) { stopCamera(); setStatus("consent"); }
      }, { once: true }));
      setCameraActive(true);
      setStatus("no_face");
      engineRef.current?.setMode("live");
      trackEvent?.("vto_camera_permission", { item_id: activeProduct?.id, permission: "accepted" });
      trackingFrameRef.current = requestAnimationFrame(runVideoTracking);
    } catch (error) {
      if (!cameraSessionRef.current.current(session) || !mountedRef.current) return;
      const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      setStatus(denied ? "denied" : "error");
      setDetail(error?.name === "NotFoundError" ? "Nuk u gjet kamerë. Vazhdoni me fotografi." : error?.name === "NotReadableError" ? "Kamera përdoret nga një aplikacion tjetër. Mbylleni dhe provoni përsëri." : "");
      trackEvent?.("vto_error", { item_id: activeProduct?.id, error: denied ? "camera_denied" : "camera_start" });
      stopCamera();
    }
  };

  const switchCamera = async () => {
    const nextFacing = cameraFacingRef.current === "user" ? "environment" : "user";
    stopCamera();
    await startCamera(nextFacing);
  };

  const switchMode = (nextMode) => {
    stopCamera();
    photoRevisionRef.current += 1;
    modeRef.current = nextMode;
    setMode(nextMode);
    setDetail("");
    setShareNotice("");
    engineRef.current?.setMode(nextMode === "viewer" ? "viewer" : nextMode);
    if (nextMode === "live") setStatus(cameraConsent ? "consent" : "consent");
    if (nextMode === "photo") setStatus(photoViews[activePhotoView] ? "photo_ready" : "idle");
    if (nextMode === "viewer") {
      setStatus("viewer");
      setFitGuidance("Pamje e qendërzuar · rrotullojeni modelin");
      setViewerRotation({ yaw: 0, pitch: 0 });
      setViewerZoom(100);
    }
    trackEvent?.("vto_mode_changed", { item_id: activeProduct?.id, mode: nextMode });
  };

  const analyzePhoto = async (source) => {
    if (!source) return;
    const revision = ++photoRevisionRef.current;
    photoResultRef.current = null;
    engineRef.current?.setFacePose(null);
    setStatus("loading");
    try {
      const tracker = await ensureTracker("IMAGE");
      await source.decode?.();
      if (revision !== photoRevisionRef.current || modeRef.current !== "photo" || !mountedRef.current) return;
      const result = tracker.detect(source);
      photoResultRef.current = result;
      const pose = processResultsRef.current?.(result, false, "photo");
      if ((result.faceLandmarks?.length || 0) <= 1) setStatus(pose ? "photo_ready" : "photo_error");
      trackEvent?.("vto_photo_analyzed", { item_id: activeProduct?.id, detected: Boolean(pose) });
    } catch (error) {
      if (revision !== photoRevisionRef.current || !mountedRef.current) return;
      engineRef.current?.setFacePose(null);
      setStatus("photo_error");
      setDetail("Fotoja nuk u analizua. Provoni një JPG të qartë, përballë, pa syze.");
    }
  };

  const openPhotoPicker = (slot = activePhotoView) => {
    photoTargetRef.current = slot;
    photoInputRef.current?.click();
  };

  const usePhotoFile = (file, slot = photoTargetRef.current || activePhotoView) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024) {
      setStatus("photo_error");
      setDetail("Përdorni JPG, PNG ose WEBP deri në 12 MB.");
      return;
    }
    const revision = ++photoRevisionRef.current;
    const reader = new FileReader();
    reader.onload = () => {
      if (!mountedRef.current || revision !== photoRevisionRef.current) return;
      stopCamera();
      modeRef.current = "photo";
      setMode("photo");
      setDetail("");
      const nextPhoto = String(reader.result || "");
      setPhotoViews((current) => ({ ...current, [slot]: nextPhoto }));
      setActivePhotoView(slot);
      engineRef.current?.setMode("photo");
      setStatus("loading");
      trackEvent?.("vto_photo_slot_added", { item_id: activeProduct?.id, slot });
    };
    reader.onerror = () => { if (mountedRef.current && revision === photoRevisionRef.current) { setStatus("photo_error"); setDetail("Fotoja nuk u lexua. Provoni një skedar tjetër."); } };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (mode === "photo" && photoData && photoRef.current) analyzePhoto(photoRef.current);
  }, [photoData, mode, activeProduct?.id, activePhotoView]);

  useEffect(() => {
    if (!fullScreen || !sectionRef.current) return undefined;
    const originalFocus = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    const section = sectionRef.current;
    document.body.style.overflow = "hidden";
    const focusable = () => [...section.querySelectorAll('button:not([disabled]), a[href], input:not([hidden]), [tabindex="0"]')].filter((item) => item.getClientRects().length);
    focusable()[0]?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); setFullScreen(false); }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    };
    section.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = originalOverflow; section.removeEventListener("keydown", handleKey); originalFocus?.focus?.(); };
  }, [fullScreen]);

  const captureComposite = async () => {
    if (!canCapture) return "";
    const stage = stageRef.current;
    const arCanvas = engineRef.current?.getCanvas();
    if (!stage || !arCanvas) return "";
    const width = Math.max(1, Math.round(stage.clientWidth * Math.min(window.devicePixelRatio || 1, 1.6)));
    const height = Math.max(1, Math.round(stage.clientHeight * Math.min(window.devicePixelRatio || 1, 1.6)));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#e9e1d7";
    context.fillRect(0, 0, width, height);
    if (mode === "live" && videoRef.current?.videoWidth) drawCover(context, videoRef.current, width, height, cameraFacingRef.current === "user");
    if (mode === "photo" && photoRef.current?.naturalWidth) drawCover(context, photoRef.current, width, height, false);
    if (mode === "viewer") {
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#f8f2e9");
      gradient.addColorStop(1, "#d9cabb");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(arCanvas, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const addCapture = async () => {
    const image = await captureComposite();
    if (!image) return;
    setCaptures((current) => [{ id: `${activeProduct.id}-${Date.now()}`, product: activeProduct, image, frameColor, lensColor }, ...current].slice(0, 4));
    trackEvent?.("vto_capture", { item_id: activeProduct.id, mode });
  };

  const downloadCapture = async () => {
    const image = await captureComposite();
    if (!image) return;
    const link = document.createElement("a");
    link.href = image;
    link.download = `${activeProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-virtual-try-on.jpg`;
    link.click();
  };

  const shareSelection = async () => {
    const shareData = {
      title: `${activeProduct.name} · Optika Miftari`,
      text: `Po provoj ${activeProduct.name} me kornizë ${frameColor} dhe lente ${lensColor}.`,
      url: `${window.location.origin}/products/${activeProduct.id}`
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        setShareNotice("Linku u kopjua.");
      }
      trackEvent?.("vto_shared", { item_id: activeProduct.id });
    } catch {
      setShareNotice("Ndarja u anulua.");
    }
  };

  const addConfiguredToCart = () => {
    if (!(Number(activeProduct?.stock) > 0)) return;
    addToCart?.(activeProduct, {
      source: "Provë virtuale 3D",
      quantity: 1
    });
    trackEvent?.("vto_add_to_cart", { item_id: activeProduct.id, item_name: activeProduct.name, mode });
  };

  const selectProduct = (product, event) => {
    if (!product) return;
    event?.currentTarget?.blur?.();
    configRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setViewerRotation({ yaw: 0, pitch: 0 });
    setViewerZoom(100);
    setSelectedId(product.id);
    trackEvent?.("vto_product_tried", { item_id: product.id });
  };

  const chooseNeighbor = (direction) => {
    const currentIndex = sunglasses.findIndex((product) => product.id === activeProduct?.id);
    const nextIndex = (currentIndex + direction + sunglasses.length) % sunglasses.length;
    selectProduct(sunglasses[nextIndex]);
  };

  const onViewerPointerDown = (event) => {
    if (mode !== "viewer" || event.target.closest("button, a, input")) return;
    draggingRef.current = { x: event.clientX, y: event.clientY, yaw: viewerRotation.yaw, pitch: viewerRotation.pitch };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onViewerPointerMove = (event) => {
    if (mode !== "viewer" || !draggingRef.current) return;
    const deltaX = event.clientX - draggingRef.current.x;
    const deltaY = event.clientY - draggingRef.current.y;
    setViewerRotation({
      yaw: clamp(draggingRef.current.yaw + deltaX * 0.006, -0.78, 0.78),
      pitch: clamp(draggingRef.current.pitch + deltaY * 0.004, -0.2, 0.2)
    });
  };

  const onViewerPointerUp = () => {
    draggingRef.current = null;
  };

  const onViewerKeyDown = (event) => {
    if (mode !== "viewer") return;
    const supportedKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"];
    if (!supportedKeys.includes(event.key)) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") setViewerRotation((current) => ({ ...current, yaw: clamp(current.yaw - 0.12, -0.78, 0.78) }));
    if (event.key === "ArrowRight") setViewerRotation((current) => ({ ...current, yaw: clamp(current.yaw + 0.12, -0.78, 0.78) }));
    if (event.key === "ArrowUp") setViewerRotation((current) => ({ ...current, pitch: clamp(current.pitch - 0.06, -0.2, 0.2) }));
    if (event.key === "ArrowDown") setViewerRotation((current) => ({ ...current, pitch: clamp(current.pitch + 0.06, -0.2, 0.2) }));
    if (event.key === "+" || event.key === "=") setViewerZoom((current) => clamp(current + 5, 80, 125));
    if (event.key === "-") setViewerZoom((current) => clamp(current - 5, 80, 125));
    if (event.key === "0") {
      setViewerRotation({ yaw: 0, pitch: 0 });
      setViewerZoom(100);
    }
  };

  return (
    <section ref={sectionRef} className={`vto3d vto3d-refined ${fullScreen ? "is-fullscreen" : ""}`} id="try-studio" aria-label="Prova virtuale 3D" role={fullScreen ? "dialog" : undefined} aria-modal={fullScreen ? true : undefined}>
      <header className="vto3d-head">
        <div>
          <span>OPTIKA MIFTARI · PROVË VIRTUALE 3D</span>
          <h2>Provoni kornizën. Pastaj kontrolloni masën.</h2>
          <p>Nisni me kamerën live, vazhdoni me fotografi ose shikoni modelin në 3D — pa krijuar llogari.</p>
        </div>
        <div className="vto3d-head-actions">
          <span><LockKeyhole size={15} /> Kamera nuk regjistrohet</span>
          <button type="button" onClick={() => setFullScreen((current) => !current)} aria-label={fullScreen ? "Mbyll ekranin e plotë" : "Hap ekranin e plotë"}>
            {fullScreen ? <X size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </header>

      <div className="vto3d-mode-tabs" role="tablist" aria-label="Mënyra e provës virtuale">
        {[
          ["live", Video, "Kamera live", "Lëvizeni kokën natyrshëm"],
          ["photo", ImageIcon, "Fotografi", "Ngarkoni deri në tri pamje"],
          ["viewer", Box, "Produkti në 3D", "Rrotulloni modelin"]
        ].map(([value, Icon, label, copy]) => (
          <button type="button" key={value} id={`vto-tab-${value}`} aria-controls="vto-panel" tabIndex={mode === value ? 0 : -1} className={mode === value ? "active" : ""} onClick={() => switchMode(value)} role="tab" aria-selected={mode === value} onKeyDown={(event) => {
            const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            const modes = ["live", "photo", "viewer"];
            const index = modes.indexOf(mode);
            const next = event.key === "Home" ? "live" : event.key === "End" ? "viewer" : modes[(index + (event.key === "ArrowRight" ? 1 : 2)) % 3];
            switchMode(next);
            document.getElementById(`vto-tab-${next}`)?.focus();
          }}>
            <Icon size={19} /><span><strong>{label}</strong><small>{copy}</small></span>
          </button>
        ))}
      </div>

      <LunaTryOnGuide mode={mode} status={status} productId={activeProduct?.id || ""}
        onMode={switchMode} onProduct={() => navigate("product", activeProduct.id)}
        onReset={() => { setManualScale(100); setManualVertical(0); setManualHorizontal(0); setManualRotation(0); setViewerRotation({ yaw: 0, pitch: 0 }); setViewerZoom(100); }} />
      <div className="vto3d-accuracy-note" role="note"><Box size={16} /><span>{modelSource === "catalogue" ? "Model 3D i katalogut. Pozicionimi është orientues; përshtatja konfirmohet në optikë." : modelSource === "unavailable" ? "Modeli i katalogut nuk u ngarkua. Po shihni një simulim të formës dhe përmasave." : "Simulim i formës dhe përmasave — jo skanim i produktit. Për pamjen e modelit, referojuni fotografisë së katalogut."}</span></div>
      <div className="vto3d-layout" id="vto-panel" role="tabpanel" aria-labelledby={`vto-tab-${mode}`}>
        <div className="vto3d-visual-column">
          <div
            className={`vto3d-stage mode-${mode}`}
            ref={stageRef}
            onPointerDown={onViewerPointerDown}
            onPointerMove={onViewerPointerMove}
            onPointerUp={onViewerPointerUp}
            onPointerCancel={onViewerPointerUp}
            onKeyDown={onViewerKeyDown}
            tabIndex={mode === "viewer" ? 0 : -1}
            aria-label={mode === "viewer" ? "Model 3D. Përdorni shigjetat për rrotullim, plus dhe minus për zmadhim." : undefined}
          >
            {mode === "live" && <video ref={videoRef} autoPlay muted playsInline className={`${cameraActive ? "visible" : ""} ${cameraFacing === "user" ? "mirrored" : ""}`} />}
            {mode === "photo" && photoData && <img ref={photoRef} src={photoData} alt="Portreti i ngarkuar për provën virtuale" />}
            {mode === "viewer" && <div className="vto3d-studio-backdrop"><span /><i /></div>}
            <div ref={renderHostRef} className="vto3d-render-host" aria-hidden="true" />

            {rendererError && <div className="vto3d-render-error" role="alert"><CircleAlert size={24} /><strong>Shfletuesi nuk e shfaq dot 3D</strong><p>Fotografia e katalogut mbetet e disponueshme. Provoni një shfletues tjetër për provën virtuale.</p><img src={activeProduct?.image} alt={activeProduct?.name || "Fotografia e produktit"} /><button type="button" onClick={() => navigate("product", activeProduct.id)}>Shiko produktin</button></div>}

            {mode === "live" && !cameraActive && !rendererError && (
              <div className="vto3d-permission-card">
                <span><Camera size={24} /></span>
                <strong>Shihni kornizën ndërsa ktheni kokën</strong>
                <p>Kamera përdoret vetëm për gjurmim në pajisjen tuaj. Nuk regjistrojmë video dhe nuk ruajmë pika të fytyrës.</p>
                <button type="button" disabled={cameraPending} onClick={() => startCamera()}>{cameraPending ? <RefreshCw className="spin" size={18} /> : <Camera size={18} />} {status === "permission" ? "Konfirmoni lejen e kamerës…" : status === "loading" ? "Po përgatitet gjurmimi…" : "Lejo kamerën dhe fillo"}</button>
                <button type="button" className="quiet" onClick={() => switchMode("photo")}>Vazhdo me fotografi</button>
              </div>
            )}

            {mode === "photo" && !photoData && (
              <button type="button" className="vto3d-photo-prompt" onClick={() => openPhotoPicker(activePhotoView)}>
                <span><ImageIcon size={28} /></span>
                <strong>Ngarko foton {photoAngleOptions.find((option) => option.id === activePhotoView)?.label.toLowerCase()}</strong>
                <small>Pa syze · dritë e mirë · JPG, PNG ose WEBP</small>
              </button>
            )}

            <div className={`vto3d-status status-${status}`} role="status" aria-live="polite">
              {status === "stable" || status === "photo_ready" || status === "viewer" ? <Check size={16} /> : status === "loading" || status === "permission" ? <RefreshCw className="spin" size={16} /> : <CircleAlert size={16} />}
              <span><strong>{statusMessage[0]}</strong><small>{detail || statusMessage[1]}</small></span>
            </div>

            <div className="vto3d-product-badge">
              <img src={activeProduct?.image} alt="" />
              <span><small>MODEL AKTIV</small><strong>{activeProduct?.name}</strong><b>{activeProduct?.frameWidth || "—"} mm</b></span>
            </div>

            {mode === "photo" && (
              <div className="vto3d-photo-angles" aria-label="Fotot nga tri kënde">
                <small>3 KËNDE</small>
                {photoAngleOptions.map((option) => {
                  const source = photoViews[option.id];
                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={activePhotoView === option.id ? "active" : ""}
                      onClick={() => source ? setActivePhotoView(option.id) : openPhotoPicker(option.id)}
                      aria-pressed={activePhotoView === option.id}
                      title={source ? `Shfaq ${option.label.toLowerCase()}` : `Shto ${option.label.toLowerCase()}`}
                    >
                      {source ? <img src={source} alt="" /> : <ImageIcon size={16} />}
                      <span>{source ? option.shortLabel : `+ ${option.shortLabel}`}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {mode !== "viewer" && (cameraActive || photoData) && (
              <div className="vto3d-face-guide" aria-hidden="true"><span /><i /></div>
            )}

            <div className="vto3d-stage-actions">
              {canCapture && <button type="button" onClick={addCapture} aria-label="Ruaj për krahasim"><Camera size={18} /> Kap pamjen</button>}
              {canCapture && <button type="button" onClick={downloadCapture} aria-label="Shkarko pamjen"><Download size={18} /></button>}
              {mode === "photo" && <button type="button" onClick={() => openPhotoPicker(activePhotoView)}><RefreshCw size={17} /> Ndrysho foto</button>}
              {mode === "live" && cameraActive && <button type="button" onClick={switchCamera} aria-label="Ndërro kamerën"><RefreshCw size={17} /> {cameraFacing === "user" ? "Kamera prapa" : "Kamera para"}</button>}
              {mode === "live" && cameraActive && <button type="button" onClick={() => { stopCamera(); setStatus("consent"); }}><X size={17} /> Fik kamerën</button>}
              {mode === "photo" && photoData && <button type="button" onClick={() => { photoRevisionRef.current += 1; photoResultRef.current = null; engineRef.current?.setFacePose(null); setPhotoViews((current) => ({ ...current, [activePhotoView]: "" })); setStatus("idle"); }} aria-label="Fshi fotografinë e zgjedhur"><X size={17} /> Fshi foto</button>}
            </div>
          </div>

          <input ref={photoInputRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => { usePhotoFile(event.target.files?.[0], photoTargetRef.current); event.target.value = ""; }} />

          {(mode === "viewer" || cameraActive || photoData) && <div className={`vto3d-manual-controls mode-${mode}`}>
            {mode === "viewer" ? (
              <>
                <div className="vto3d-view-presets" aria-label="Pamjet e produktit">
                  <button type="button" className={viewerRotation.yaw < -0.2 ? "active" : ""} onClick={() => setViewerRotation({ yaw: -0.7, pitch: 0 })}>Majtas</button>
                  <button type="button" className={Math.abs(viewerRotation.yaw) <= 0.2 ? "active" : ""} onClick={() => setViewerRotation({ yaw: 0, pitch: 0 })}>Përballë</button>
                  <button type="button" className={viewerRotation.yaw > 0.2 ? "active" : ""} onClick={() => setViewerRotation({ yaw: 0.7, pitch: 0 })}>Djathtas</button>
                </div>
                <label><span>Këndi <b>{Math.round(viewerRotation.yaw * 57.3)}°</b></span><input type="range" min="-45" max="45" value={Math.round(viewerRotation.yaw * 57.3)} onChange={(event) => setViewerRotation((current) => ({ ...current, yaw: Number(event.target.value) / 57.3 }))} /></label>
                <label><span>Zmadhimi <b>{viewerZoom}%</b></span><input type="range" min="80" max="125" value={viewerZoom} onChange={(event) => setViewerZoom(Number(event.target.value))} /></label>
                <button type="button" onClick={() => { setViewerRotation({ yaw: 0, pitch: 0 }); setViewerZoom(100); }}><RefreshCw size={15} /> Qendërzo pamjen</button>
              </>
            ) : (
              <>
                <label><span>Madhësia manuale <b>{manualScale}%</b></span><input type="range" min="78" max="125" value={manualScale} onChange={(event) => setManualScale(Number(event.target.value))} /></label>
                <label><span>Pozicioni vertikal <b>{manualVertical > 0 ? "+" : ""}{manualVertical}</b></span><input type="range" min="-12" max="12" value={manualVertical} onChange={(event) => setManualVertical(Number(event.target.value))} /></label>
                <label><span>Pozicioni horizontal <b>{manualHorizontal > 0 ? "+" : ""}{manualHorizontal}</b></span><input type="range" min="-12" max="12" value={manualHorizontal} onChange={(event) => setManualHorizontal(Number(event.target.value))} /></label>
                <label><span>Rrotullimi manual <b>{manualRotation}°</b></span><input type="range" min="-18" max="18" value={manualRotation} onChange={(event) => setManualRotation(Number(event.target.value))} /></label>
                <button type="button" onClick={() => { setManualScale(100); setManualVertical(0); setManualHorizontal(0); setManualRotation(0); }}><Ruler size={15} /> Qendërzo</button>
              </>
            )}
          </div>}

          {captures.length > 0 && (
            <div className="vto3d-compare-tray">
              <div><span>KRAHASIMI</span><strong>{captures.length}/4 pamje</strong></div>
              <div className="vto3d-captures">
                {captures.map((capture) => (
                  <button type="button" key={capture.id} onClick={(event) => selectProduct(capture.product, event)} title={`${capture.product.name} · ${optionLabel(capture.frameColor)} · ${optionLabel(capture.lensColor)}`}>
                    <img src={capture.image} alt={`Pamje e ruajtur e ${capture.product.name}`} />
                    <span>{capture.product.name}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setCaptures([])}><X size={15} /> Pastro</button>
            </div>
          )}
        </div>

        <aside ref={configRef} className="vto3d-config">
          <div className="vto3d-current-product">
            <button type="button" onClick={() => chooseNeighbor(-1)} aria-label="Modeli i mëparshëm"><ChevronLeft size={18} /></button>
            <img src={activeProduct?.image} alt="" />
            <div><small>{activeProduct?.collection}</small><strong>{activeProduct?.name}</strong><span>{money(selectedPrice)} · {activeProduct?.stock > 0 ? `${activeProduct.stock} në stok` : "Me porosi"}</span></div>
            <button type="button" onClick={() => chooseNeighbor(1)} aria-label="Modeli tjetër"><ChevronRight size={18} /></button>
          </div>

          <div className="vto3d-purchase">
            <button type="button" className="primary" disabled={!(Number(activeProduct?.stock) > 0)} onClick={addConfiguredToCart}><ShoppingBag size={19} /> {Number(activeProduct?.stock) > 0 ? `Shto kornizën · ${money(selectedPrice)}` : "Aktualisht pa stok"}</button>
            <button type="button" onClick={() => navigate("product", activeProduct.id)}><Eye size={17} /> Vazhdo te lentet me dioptri</button>
            <p className="vto3d-order-note">Në shportë shtohet modeli i katalogut. Ngjyrat dhe intensiteti i simuluar nuk ndryshojnë porosinë; opsionet e lenteve zgjidhen te produkti.</p>
          </div>

          <section className="vto3d-option-section">
            <div><span>01</span><h3>Ngjyra e kornizës</h3><small>{optionLabel(frameColor)}</small></div>
            <div className="vto3d-swatches">
              {colors.map((color) => (
                <button type="button" key={color} aria-pressed={frameColor === color} className={frameColor === color ? "active" : ""} onClick={() => { setFrameColor(color); trackEvent?.("vto_frame_color", { item_id: activeProduct.id, color }); }} aria-label={`Korniza ${optionLabel(color)}`}>
                  <i style={{ background: colorFromName(color) }} /><span>{optionLabel(color)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="vto3d-option-section">
            <div><span>02</span><h3>Lentja</h3><small>{optionLabel(lensColor)}</small></div>
            <div className="vto3d-lens-options">
              {lensOptions.map((lens) => (
                <button type="button" key={lens} aria-pressed={lensColor === lens} className={lensColor === lens ? "active" : ""} onClick={() => { setLensColor(lens); trackEvent?.("vto_lens_changed", { item_id: activeProduct.id, lens }); }}>
                  <i style={{ background: colorFromName(lens, "#4b554f") }} /><span>{optionLabel(lens)}</span>
                </button>
              ))}
            </div>
            <label className="vto3d-tint"><span>Intensiteti vizual <b>{lensOpacity}%</b></span><input type="range" min="25" max="88" value={lensOpacity} onChange={(event) => setLensOpacity(Number(event.target.value))} /></label>
            <p>Ngjyra dhe intensiteti janë vizualizim; nuk përfaqësojnë transmetim optik ose rezultat mjekësor të garantuar.</p>
          </section>

          <section className="vto3d-fit-card">
            <div><Ruler size={19} /><span><small>UDHËZIMI I PËRSHTATJES</small><strong>{fitGuidance}</strong></span></div>
            <dl>
              <div><dt>Gjerësia</dt><dd>{activeProduct?.frameWidth || "—"} mm</dd></div>
              <div><dt>Lentja</dt><dd>{activeProduct?.lensWidth || "—"} mm</dd></div>
              <div><dt>Ura</dt><dd>{activeProduct?.bridgeWidth || "—"} mm</dd></div>
              <div><dt>Bishti</dt><dd>{activeProduct?.templeLength || "—"} mm</dd></div>
            </dl>
            <button type="button" onClick={openMeasurement}><Ruler size={16} /> Kalibro me kartë ose PD</button>
          </section>

          <div className="vto3d-session-actions">
            <button type="button" className={wishlist?.has(activeProduct.id) ? "active" : ""} onClick={() => { toggleWishlist?.(activeProduct.id); trackEvent?.("vto_favorite", { item_id: activeProduct.id }); }}><Heart size={17} /> {wishlist?.has(activeProduct.id) ? "E ruajtur" : "Ruaj"}</button>
            <button type="button" className={compare?.has(activeProduct.id) ? "active" : ""} onClick={() => { toggleCompare?.(activeProduct.id); trackEvent?.("vto_compare", { item_id: activeProduct.id }); }}><Layers3 size={17} /> Krahaso</button>
            <button type="button" onClick={shareSelection}><Share2 size={17} /> Ndaj</button>
          </div>
          {shareNotice && <p className="vto3d-share-notice">{shareNotice}</p>}

          <div className="vto3d-support-actions">
            <button type="button" onClick={() => { trackEvent?.("vto_fitting_requested", { item_id: activeProduct.id }); navigate("contact", undefined, "/contact#booking"); }}>Rezervo përshtatje në optikë</button>
            <button type="button" onClick={() => { trackEvent?.("vto_alignment_report", { item_id: activeProduct.id, mode }); navigate("contact"); }}>Raporto pozicionimin</button>
          </div>

          <p className="vto3d-clinical-note"><LockKeyhole size={15} /> Prova virtuale është një orientim vizual dhe nuk zëvendëson matjet ose përshtatjen profesionale në optikë.</p>

          <div className="vto3d-model-list">
            <div><h3>Zgjidh modelin</h3><span>{availableCount} modele në dispozicion</span></div>
            <div>
              {sunglasses.map((product) => (
                <button type="button" key={product.id} className={product.id === activeProduct?.id ? "active" : ""} onClick={(event) => selectProduct(product, event)}>
                  <img src={product.image} alt="" loading="lazy" />
                  <span><strong>{product.name}</strong><small>{product.frameWidth || "—"} mm · {money(product.salePrice || product.price)}</small></span>
                  {product.id === activeProduct?.id && <Check size={15} />}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
