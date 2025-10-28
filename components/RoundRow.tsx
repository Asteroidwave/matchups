"use client";

import { RoundResult, Matchup } from "@/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

interface RoundRowProps {
  result: RoundResult;
  matchups: Matchup[];
  onPickClick: (matchupId: string, selectedSet: "A" | "B") => void;
}

export function RoundRow({ result, matchups, onPickClick }: RoundRowProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={result.id} className="border rounded-lg bg-white shadow-sm mb-3">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center justify-between w-full pr-4">
            <div className="flex items-center gap-4">
              <div className="text-left">
                <div className="font-semibold text-gray-900">
                  {result.picks} Pick{result.picks !== 1 ? "s" : ""}
                </div>
                <div className="text-sm text-gray-500">
                  {formatDate(result.createdAt)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right mr-4">
                <div className="text-sm text-gray-600">Total Points</div>
                <div className="text-lg font-bold text-gray-900">
                  {result.totalPoints}
                </div>
              </div>
              {result.won ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-sm px-3 py-1">
                  Won ${result.totalPoints?.toFixed(1) || "0.0"}
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-sm px-3 py-1">
                  Lost $0.0
                </Badge>
              )}
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-6 pb-6">
          <div className="space-y-3 mt-4">
            {result.details.map((detail, index) => {
              const matchup = matchups.find((m) => m.id === detail.matchupId);
              if (!matchup) return null;

              return (
                <div
                  key={`${detail.matchupId}-${index}`}
                  onClick={() => onPickClick(detail.matchupId, detail.selectedSet)}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {detail.won ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">
                        Pick {index + 1}: {matchup.title}
                      </div>
                      <div className="text-sm text-gray-600">
                        Set {detail.selectedSet} •{" "}
                        {detail.selectedSet === "A"
                          ? matchup.setA.members.length
                          : matchup.setB.members.length}{" "}
                        connection
                        {(detail.selectedSet === "A"
                          ? matchup.setA.members.length
                          : matchup.setB.members.length) !== 1
                          ? "s"
                          : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Your Points</div>
                      <div className="text-xl font-bold text-blue-600">
                        {detail.setPoints}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Opponent</div>
                      <div className="text-xl font-bold text-gray-900">
                        {detail.opponentPoints}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
