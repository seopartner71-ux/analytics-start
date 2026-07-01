import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, RotateCw, ZoomIn } from "lucide-react";

interface Props {
  open: boolean;
  imageSrc: string | null;
  saving?: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}

async function getCroppedBlob(imageSrc: string, area: Area, rotation: number): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (!imageSrc.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bBoxW = image.width * cos + image.height * sin;
  const bBoxH = image.width * sin + image.height * cos;

  const canvas = document.createElement("canvas");
  canvas.width = bBoxW;
  canvas.height = bBoxH;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(bBoxW / 2, bBoxH / 2);
  ctx.rotate(rad);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  const data = ctx.getImageData(area.x, area.y, area.width, area.height);
  const out = document.createElement("canvas");
  const size = Math.min(512, Math.round(area.width));
  out.width = size;
  out.height = size;
  const octx = out.getContext("2d")!;
  const tmp = document.createElement("canvas");
  tmp.width = area.width;
  tmp.height = area.height;
  tmp.getContext("2d")!.putImageData(data, 0, 0);
  octx.drawImage(tmp, 0, 0, size, size);

  return new Promise<Blob>((resolve) => {
    out.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.9);
  });
}

export default function AvatarEditorDialog({ open, imageSrc, saving, onCancel, onSave }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pixels, setPixels] = useState<Area | null>(null);

  const onComplete = useCallback((_: Area, p: Area) => setPixels(p), []);

  const handleSave = async () => {
    if (!imageSrc || !pixels) return;
    const blob = await getCroppedBlob(imageSrc, pixels, rotation);
    onSave(blob);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Настройте фото</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-72 bg-muted rounded-md overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onComplete}
            />
          )}
        </div>
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider min={1} max={4} step={0.05} value={[zoom]} onValueChange={(v) => setZoom(v[0])} />
          </div>
          <div className="flex items-center gap-3">
            <RotateCw className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider min={0} max={360} step={1} value={[rotation]} onValueChange={(v) => setRotation(v[0])} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving || !pixels}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
