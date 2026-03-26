//
//  ContentView.swift
//  Fyp_WatchDataAPI Watch App
//
//  Created by Nelson Hui on 26/3/2026.
//

import SwiftUI

enum ExerciseType: String, CaseIterable {
    case strength = "Strength"
    case hiit = "HIIT"
    case cardio = "Cardio"
}

struct ContentView: View {
    @StateObject private var workoutManager = WorkoutManager()
    @State private var isWorkoutActive = false
    @State private var selectedExerciseType: ExerciseType = .strength
    @State private var isRestPhase = false
    @State private var setCount = 0
    @State private var phaseStartDate: Date? = nil
    @State private var now = Date()

    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Text("Workout Tracker")
                    .font(.headline)

                Divider()

                // Status Message
                Text(workoutManager.statusMessage)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                // Auth Button
                if !workoutManager.isAuthorized {
                    Button(action: {
                        workoutManager.requestAuthorization()
                    }) {
                        Text("Authorize")
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                } else {
                    if isWorkoutActive {
                        VStack(spacing: 6) {
                            Text("Exercise")
                                .font(.caption2)
                                .foregroundColor(.secondary)

                            HStack {
                                Spacer(minLength: 0)
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 4) {
                                        ForEach(ExerciseType.allCases, id: \.self) { type in
                                            Button(type.rawValue) {
                                                selectedExerciseType = type
                                            }
                                            .font(.system(size: 10, weight: .semibold))
                                            .lineLimit(1)
                                            .minimumScaleFactor(0.7)
                                            .buttonStyle(.bordered)
                                            .tint(selectedExerciseType == type ? .blue : .gray)
                                        }
                                    }
                                }
                                .fixedSize(horizontal: true, vertical: false)
                                Spacer(minLength: 0)
                            }
                        }
                        .frame(maxWidth: .infinity)

                        Text("Current: \(selectedExerciseType.rawValue)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }

                    // Workout Stats
                    VStack(spacing: 4) {
                        HStack {
                            Text("❤️")
                            Text("\(Int(workoutManager.heartRate)) bpm")
                                .font(.caption)
                        }
                        HStack {
                            Text("🔥")
                            Text("\(Int(workoutManager.activeEnergy)) kcal")
                                .font(.caption)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Divider()

                    if isWorkoutActive {
                        VStack(spacing: 4) {
                            HStack {
                                Text(isRestPhase ? "Phase: Rest" : "Phase: Set")
                                    .font(.caption2)
                                    .foregroundColor(isRestPhase ? .orange : .green)
                                Spacer()
                                Text(phaseElapsedText)
                                    .font(.caption2)
                            }

                            HStack {
                                Text("Set")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text("#\(setCount)")
                                    .font(.caption2)
                            }

                            Button(action: {
                                if isRestPhase {
                                    setCount += 1
                                }
                                isRestPhase.toggle()
                                phaseStartDate = Date()
                            }) {
                                Text(isRestPhase ? "Start Set" : "Start Rest")
                                    .font(.caption2)
                            }
                            .buttonStyle(.bordered)
                            .tint(isRestPhase ? .green : .orange)
                        }
                    }

                    // Start/Stop Buttons
                    if isWorkoutActive {
                        Button(action: {
                            workoutManager.endWorkout()
                            isWorkoutActive = false
                            phaseStartDate = nil
                        }) {
                            Text("End Workout")
                                .font(.caption2)
                        }
                        .buttonStyle(.bordered)
                        .tint(.red)
                    } else {
                        Button(action: {
                            workoutManager.startWorkout()
                            isWorkoutActive = true
                            isRestPhase = false
                            setCount = 1
                            phaseStartDate = Date()
                        }) {
                            Text("Start Workout")
                                .font(.caption2)
                        }
                        .buttonStyle(.bordered)
                        .tint(.green)
                    }
                }
            }
            .padding()
        }
        .onReceive(tick) { value in
            now = value
        }
    }

    private var phaseElapsedText: String {
        guard let start = phaseStartDate else { return "00:00" }
        let elapsed = Int(now.timeIntervalSince(start))
        let minutes = elapsed / 60
        let seconds = elapsed % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}

#Preview {
    ContentView()
}
