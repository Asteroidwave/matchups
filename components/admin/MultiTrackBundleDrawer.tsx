"use client";

import React from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { Matchup } from "@/types";

interface MultiTrackBundleDrawerProps {
  open: boolean;
  onClose: () => void;
  bundle?: {
    id: string;
    trackCodes: string[];
    matchupTypes: string[];
    matchupCount: number;
    createdAt: string;
    matchups: Matchup[];
  } | null;
}

export function MultiTrackBundleDrawer({
  open,
  onClose,
  bundle,
}: MultiTrackBundleDrawerProps) {
  if (!bundle) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(bundle.id).catch(() => {});
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(bundle.matchups, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `multi-track-bundle-${bundle.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader>
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-lg">Multi-Track Bundle</DrawerTitle>
              <p className="text-sm text-muted-foreground">
                Created {new Date(bundle.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyId}>
                <Copy className="w-4 h-4 mr-2" />
                Copy ID
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download JSON
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {bundle.trackCodes.map((track) => (
              <Badge key={track} variant="secondary">{track}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {bundle.matchupTypes.map((type) => (
              <Badge key={type} variant="outline">{type.replace(/_/g, " ")}</Badge>
            ))}
          </div>
        </DrawerHeader>
        <div className="px-6 pb-6 overflow-y-auto space-y-4">
          {bundle.matchups.slice(0, 25).map((matchup) => (
            <div key={matchup.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{matchup.matchupType?.replace(/_/g, " ") || "mixed"}</span>
                <span>{matchup.id}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-semibold mb-1">Set A</div>
                  {matchup.setA.connections.map((conn) => (
                    <div key={conn.id}>{conn.name} ({conn.trackSet.join(", ")})</div>
                  ))}
                </div>
                <div>
                  <div className="font-semibold mb-1">Set B</div>
                  {matchup.setB.connections.map((conn) => (
                    <div key={conn.id}>{conn.name} ({conn.trackSet.join(", ")})</div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {bundle.matchups.length > 25 && (
            <p className="text-sm text-muted-foreground">
              Showing 25 of {bundle.matchups.length} matchups. Download for full list.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

