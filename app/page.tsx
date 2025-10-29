"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, TrendingUp, Zap, Shield, ArrowRight, Users, DollarSign } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="mb-8">
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="w-20 h-20 bg-yellow-400 rounded-2xl flex items-center justify-center font-bold text-4xl text-gray-900 shadow-lg">
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
                className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-8 py-6 text-lg shadow-xl"
              >
                Start Playing
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                onClick={() => router.push("/results")}
                size="lg"
                variant="outline"
                className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-gray-900 font-bold px-8 py-6 text-lg"
              >
                View Results
              </Button>
            </div>
            
            {/* Stats Bar */}
            <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mt-12">
              <div className="text-center">
                <div className="text-4xl font-bold text-yellow-400 mb-2">$1,000</div>
                <div className="text-sm text-gray-400">Starting Bankroll</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-yellow-400 mb-2">28%</div>
                <div className="text-sm text-gray-400">House Edge</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-yellow-400 mb-2">2-10</div>
                <div className="text-sm text-gray-400">Picks per Round</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center border-2 border-gray-200 hover:border-yellow-400 transition-colors">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Pick Your Matchups</h3>
              <p className="text-gray-600">
                Choose between 2 and 10 matchups. Each matchup features Set A vs Set B with balanced salaries.
              </p>
            </Card>
            
            <Card className="p-8 text-center border-2 border-gray-200 hover:border-yellow-400 transition-colors">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Set Your Multiplier</h3>
              <p className="text-gray-600">
                Select your multiplier (up to 6x) to determine your potential payout. Higher risk, higher reward.
              </p>
            </Card>
            
            <Card className="p-8 text-center border-2 border-gray-200 hover:border-yellow-400 transition-colors">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Win Big</h3>
              <p className="text-gray-600">
                Win only if ALL your picks win their matchups. Track your results and build your bankroll.
              </p>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Game Rules Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Game Rules
          </h2>
          
          <div className="space-y-4">
            <Card className="p-6 bg-white">
              <div className="flex items-start gap-4">
                <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Matchup Scoring</h3>
                  <p className="text-gray-600">
                    A set wins if its total points exceed the opponent's total points. Points come from race finishes (1st, 2nd, 3rd place).
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-6 bg-white">
              <div className="flex items-start gap-4">
                <TrendingUp className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Round Rules</h3>
                  <p className="text-gray-600">
                    A round wins only if ALL chosen sets win their respective matchups. One loss = entire round loses.
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-6 bg-white">
              <div className="flex items-start gap-4">
                <DollarSign className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Bankroll & Multipliers</h3>
                  <p className="text-gray-600">
                    Start with $1,000. Multipliers range from 1.44x to 4.32x (after 28% house take). All payouts are final.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      {/* CTA Section */}
      <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Ready to Play?
          </h2>
          <p className="text-xl text-gray-800 mb-8">
            Join the action and test your horse racing knowledge
          </p>
          <Button
            onClick={() => router.push("/matchups")}
            size="lg"
            className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-10 py-6 text-lg"
          >
            Get Started
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
