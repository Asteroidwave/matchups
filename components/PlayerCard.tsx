"use client";

import { Connection } from "@/types";
import { calculateConnectionPoints } from "@/lib/points";

interface PlayerCardProps {
  connection: Connection;
  onClick?: () => void;
  points?: number;
}

export function PlayerCard({ connection, onClick, points }: PlayerCardProps) {
  const displayPoints = points ?? calculateConnectionPoints(connection);

  const getRoleColor = (role: string) => {
    switch (role) {
      case "JOCKEY":
        return "bg-blue-100 text-blue-700";
      case "TRAINER":
        return "bg-green-100 text-green-700";
      case "SIRE":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl shadow-sm border bg-white ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
    >
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1 flex flex-col justify-center">
            <div className="text-blue-600 font-semibold text-sm mb-1">
              {connection.name}
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full inline-block w-fit ${getRoleColor(
                connection.role
              )}`}
            >
              {connection.role}
            </span>
          </div>

          <div className="col-span-2">
            <div className="grid grid-cols-3 gap-4 justify-items-end text-xs">
              <div className="text-center">
                <div className="text-gray-500 mb-1">App</div>
                <div className="font-semibold text-gray-900">
                  {connection.appearances}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 mb-1">Odds</div>
                <div className="font-semibold text-gray-900">
                  {connection.avgOdds.toFixed(1)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 mb-1">AVPA</div>
                <div className="font-semibold text-gray-900">
                  {connection.avpa30d.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 py-2 px-4 rounded-b-2xl text-center">
        <div className="text-lg font-semibold text-gray-900">
          ${connection.salary.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
