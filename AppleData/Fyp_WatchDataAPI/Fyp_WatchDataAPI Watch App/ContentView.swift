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
    @State private var backendURL: String = ""
    @State private var pairingCode: String = ""

    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    
    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Text("Workout Tracker")
                    .font(.headline)

                Divider()

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
                    VStack(spacing: 6) {
                        Text("Backend URL")
                            .font(.caption2)
                            .foregroundColor(.secondary)

                        TextField("http://192.168.x.x:3000", text: $backendURL)
                            .font(.caption2)

                        Button("Save Backend URL") {
                            let trimmed = backendURL.trimmingCharacters(in: .whitespacesAndNewlines)
                            if !trimmed.isEmpty {
                                workoutManager.backendBaseURL = trimmed
                                workoutManager.statusMessage = "Saved backend URL"
                            }
                        }
                        .buttonStyle(.bordered)
                        .font(.caption2)

                        Text("Pairing Code")
                            .font(.caption2)
                            .foregroundColor(.secondary)

                        TextField("6-digit code", text: $pairingCode)
                            .font(.caption2)

                        Button(workoutManager.isBackendPaired ? "Re-pair Watch" : "Pair Watch") {
                            workoutManager.pairWithCode(pairingCode) { success, message in
                                workoutManager.statusMessage = success ? "✓ \(message)" : "Pairing error: \(message)"
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .font(.caption2)

                        Text(workoutManager.isBackendPaired ? "Backend: Paired" : "Backend: Not paired")
                            .font(.caption2)
                            .foregroundColor(workoutManager.isBackendPaired ? .green : .orange)
                    }

                    Divider()

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

                    // Dedicated Feedback Box (reserved space for feedback display)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("💬 Feedback")
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .foregroundColor(.blue)

                        Text(workoutManager.statusMessage)
                            .font(.caption2)
                            .foregroundColor(.primary)
                            .lineLimit(5)
                            .truncationMode(.tail)
                            .frame(maxWidth: .infinity, maxHeight: 60, alignment: .topLeading)
                            .padding(6)
                            .background(Color(.systemGray6))
                            .cornerRadius(4)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(8)
                    .background(Color(.systemGray5))
                    .cornerRadius(6)

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
                                let wasRestPhase = isRestPhase
                                if isRestPhase {
                                    setCount += 1
                                }
                                isRestPhase.toggle()
                                phaseStartDate = Date()

                                // Call feedback endpoint when entering rest phase.
                                if !wasRestPhase && isRestPhase {
                                    workoutManager.sendInSessionFeedback(
                                        exerciseType: selectedExerciseType.rawValue,
                                        setCount: setCount,
                                        restDuration: 0
                                    ) { success, message in
                                        workoutManager.statusMessage = success
                                            ? "Coach: \(message)"
                                            : "Feedback error: \(message)"
                                    }
                                }
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
                            let restMinutes = currentPhaseElapsedMinutes
                            workoutManager.sendSessionEnd(
                                exerciseType: selectedExerciseType.rawValue,
                                setCount: setCount,
                                restDuration: restMinutes
                            ) { success, message in
                                workoutManager.statusMessage = success
                                    ? "✓ \(message)"
                                    : "Session save error: \(message)"
                            }

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
        .onAppear {
            backendURL = workoutManager.backendBaseURL
        }
    }

    private var phaseElapsedText: String {
        guard let start = phaseStartDate else { return "00:00" }
        let elapsed = Int(now.timeIntervalSince(start))
        let minutes = elapsed / 60
        let seconds = elapsed % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    private var currentPhaseElapsedMinutes: Int {
        guard let start = phaseStartDate else { return 0 }
        let elapsed = Int(now.timeIntervalSince(start))
        return max(0, elapsed / 60)
    }
}

#Preview {
    ContentView()
}
