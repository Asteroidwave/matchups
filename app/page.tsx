"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, TrendingUp, Zap, Shield, ArrowRight, Users, DollarSign } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-[var(--surface-1)]">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0a0e14] via-[#121820] to-[#0a0e14] dark:from-[#0a0e14] dark:via-[#121820] dark:to-[#0a0e14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="w-20 h-20 bg-[var(--brand)] rounded-2xl flex items-center justify-center font-bold text-4xl text-white shadow-lg">
                  HR
                </div>
                <h1 className="text-6xl font-extrabold text-white">
                  Horse Racing
                </h1>
              </div>
              <p className="text-2xl text-gray-300 mb-4">
                Fantasy Matchups • Real Action
              </p>
              <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
                Pick your winning sets in head-to-head matchups. Build your round, set your multiplier, and win big.
              </p>
            </div>
            
            <div className="flex gap-4 justify-center mb-12">
              <Button
                onClick={() => router.push("/matchups")}
                size="lg"
                className="bg-[var(--brand)] hover:bg-[var(--brand)]/90 text-white font-bold px-8 py-6 text-lg shadow-xl"
              >
                Start Playing
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                onClick={() => router.push("/results")}
                size="lg"
                variant="outline"
                className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-[var(--surface-1)] font-bold px-8 py-6 text-lg"
              >
                View Results
              </Button>
            </div>
            
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mt-12">
              <div className="text-center">
                <div className="text-4xl font-bold text-[var(--brand)] mb-2">$1,000</div>
                <div className="text-sm text-gray-400">Starting Bankroll</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[var(--brand)] mb-2">20%</div>
                <div className="text-sm text-gray-400">House Edge</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-[var(--brand)] mb-2">2-10</div>
                <div className="text-sm text-gray-400">Picks per Round</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="bg-[var(--surface-1)] dark:bg-[var(--surface-2)] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-[var(--text-primary)] mb-12">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center border-2 border-[var(--content-15)] bg-[var(--surface-1)] hover:border-[var(--brand)] transition-colors">
              <div className="w-16 h-16 bg-[var(--jockey)]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-[var(--jockey)]" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">Pick Your Matchups</h3>
              <p className="text-[var(--text-secondary)]">
                Choose between 2 and 10 matchups. Each matchup features Set A vs Set B with balanced salaries.
              </p>
            </Card>
            
            <Card className="p-8 text-center border-2 border-[var(--content-15)] bg-[var(--surface-1)] hover:border-[var(--brand)] transition-colors">
              <div className="w-16 h-16 bg-[var(--trainer)]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-[var(--trainer)]" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">Set Your Multiplier</h3>
              <p className="text-[var(--text-secondary)]">
                Select your multiplier (up to 800x) to determine your potential payout. Higher risk, higher reward.
              </p>
            </Card>
            
            <Card className="p-8 text-center border-2 border-[var(--content-15)] bg-[var(--surface-1)] hover:border-[var(--brand)] transition-colors">
              <div className="w-16 h-16 bg-[var(--sire)]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-[var(--sire)]" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">Win Big</h3>
              <p className="text-[var(--text-secondary)]">
                Win only if ALL your picks win their matchups. Track your results and build your bankroll.
              </p>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Game Rules Section */}
      <div className="bg-[var(--surface-2)] py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-[var(--text-primary)] mb-8">
            Game Rules
          </h2>
          
          <div className="space-y-4">
            <Card className="p-6 bg-[var(--surface-1)] border border-[var(--content-15)]">
              <div className="flex items-start gap-4">
                <Shield className="w-6 h-6 text-[var(--jockey)] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] mb-2">Matchup Scoring</h3>
                  <p className="text-[var(--text-secondary)]">
                    A set wins if its total points exceed the opponent's total points. Points come from race finishes (1st, 2nd, 3rd place).
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-6 bg-[var(--surface-1)] border border-[var(--content-15)]">
              <div className="flex items-start gap-4">
                <TrendingUp className="w-6 h-6 text-[var(--trainer)] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] mb-2">Round Rules</h3>
                  <p className="text-[var(--text-secondary)]">
                    A round wins only if ALL chosen sets win their respective matchups. One loss = entire round loses.
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-6 bg-[var(--surface-1)] border border-[var(--content-15)]">
              <div className="flex items-start gap-4">
                <DollarSign className="w-6 h-6 text-[var(--sire)] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-[var(--text-primary)] mb-2">Bankroll & Multipliers</h3>
                  <p className="text-[var(--text-secondary)]">
                    Start with $1,000. Multipliers range from 3x to 800x (after 20% house take). All payouts are final.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      {/* CTA Section */}
      <div className="bg-gradient-to-r from-[var(--brand)] to-[var(--brand)]/80 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Play?
          </h2>
          <p className="text-xl text-white/80 mb-8">
            Join the action and test your horse racing knowledge
          </p>
          <Button
            onClick={() => router.push("/matchups")}
            size="lg"
            className="bg-white hover:bg-gray-100 text-[var(--brand)] font-bold px-10 py-6 text-lg"
          >
            Get Started
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
