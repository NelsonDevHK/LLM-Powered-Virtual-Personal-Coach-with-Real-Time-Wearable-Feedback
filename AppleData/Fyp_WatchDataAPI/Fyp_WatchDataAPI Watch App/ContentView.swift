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

                        TextField("192.168.x.x", text: $backendURL)
                            .font(.caption2)

                        Button("Save Backend URL") {
                            let trimmed = backendURL.trimmingCharacters(in: .whitespacesAndNewlines)
                            if !trimmed.isEmpty {
                                workoutManager.backendBaseURL = trimmed
                                workoutManager.statusMessage = "Saved backend IP/URL"
                            }
                        }
                        .buttonStyle(.bordered)
                        .font(.caption2)

                        Text("Pairing Code")
                            .font(.caption2)
                            .foregroundColor(.secondary)

                        TextField("6-digit code", text: $pairingCode)
                            .font(.caption2)

                        Button(workoutManager.isPairingInProgress ? "Pairing..." : (workoutManager.isBackendPaired ? "Re-pair Watch" : "Pair Watch")) {
                            workoutManager.pairWithCode(pairingCode) { success, message in
                                workoutManager.statusMessage = success ? "✓ \(message)" : "Pairing error: \(message)"
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .font(.caption2)
                        .disabled(workoutManager.isPairingInProgress)

                        Text(backendPairingStatusText)
                            .font(.caption2)
                            .foregroundColor(backendPairingStatusColor)
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
                            .foregroundColor(.white)

                        ScrollView(.vertical, showsIndicators: true) {
                            Text(workoutManager.statusMessage)
                                .font(.caption2)
                                .foregroundColor(.white)
                                .fixedSize(horizontal: false, vertical: true)
                                .frame(maxWidth: .infinity, alignment: .topLeading)
                                .multilineTextAlignment(.leading)
                        }
                        .frame(maxWidth: .infinity, minHeight: 80, maxHeight: 120, alignment: .topLeading)
                        .padding(6)
                        .background(Color(.sRGB, red: 0.2, green: 0.2, blue: 0.2, opacity: 1))
                        .cornerRadius(4)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(8)
                    .background(Color(.sRGB, red: 0.15, green: 0.15, blue: 0.15, opacity: 1))
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
                                if isRestPhase {
                                    let restMinutes = currentPhaseElapsedMinutes
                                    let completedSetCount = setCount
                                    workoutManager.sendSetEnd(
                                        exerciseType: selectedExerciseType.rawValue,
                                        setCount: completedSetCount,
                                        restDuration: restMinutes
                                    ) { success, message in
                                        workoutManager.statusMessage = success
                                            ? "✓ \(message)"
                                            : "Set save error: \(message)"

                                        if success {
                                            workoutManager.clearWorkoutHeartRateReadings()
                                            setCount += 1
                                            isRestPhase = false
                                            phaseStartDate = Date()
                                        }
                                    }
                                } else {
                                    isRestPhase = true
                                    phaseStartDate = Date()
                                }
                            }) {
                                Text(isRestPhase ? "Start Set" : "Start Rest")
                                    .font(.caption2)
                            }
                            .buttonStyle(.bordered)
                            .tint(isRestPhase ? .green : .orange)

                            Button(action: {
                                let restMinutes = currentPhaseElapsedMinutes
                                workoutManager.sendInSessionFeedback(
                                    exerciseType: selectedExerciseType.rawValue,
                                    setCount: setCount,
                                    restDuration: restMinutes
                                ) { success, message in
                                    workoutManager.statusMessage = success
                                        ? "Coach: \(message)"
                                        : "Feedback error: \(message)"
                                }
                            }) {
                                Text("Get Feedback")
                                    .font(.caption2)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.blue)
                        }
                    }

                    // Start/Stop Buttons
                    if isWorkoutActive {
                        Button(action: {
                            if isRestPhase {
                                let restMinutes = currentPhaseElapsedMinutes
                                let completedSetCount = setCount
                                workoutManager.sendSetEnd(
                                    exerciseType: selectedExerciseType.rawValue,
                                    setCount: completedSetCount,
                                    restDuration: restMinutes
                                ) { success, message in
                                    if success {
                                        workoutManager.statusMessage = "✓ \(message)\nWorkout ended. Great job!"
                                        workoutManager.clearWorkoutHeartRateReadings()
                                    } else {
                                        workoutManager.statusMessage = "Final set save error: \(message)\nWorkout ended. Great job!"
                                    }

                                    workoutManager.endWorkout()
                                    isWorkoutActive = false
                                    isRestPhase = false
                                    phaseStartDate = nil
                                }
                            } else {
                                workoutManager.endWorkout()
                                workoutManager.statusMessage = "Workout ended. Great job!"
                                isWorkoutActive = false
                                phaseStartDate = nil
                            }
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

private extension ContentView {
    var backendPairingStatusText: String {
        if workoutManager.isPairingInProgress {
            return "Backend: Pairing in progress"
        }
        if workoutManager.isBackendPaired {
            return "Backend: Paired"
        }
        if workoutManager.hasSavedWatchJWT {
            return "Backend: Saved token (not verified)"
        }
        return "Backend: Not paired"
    }

    var backendPairingStatusColor: Color {
        if workoutManager.isPairingInProgress {
            return .blue
        }
        if workoutManager.isBackendPaired {
            return .green
        }
        if workoutManager.hasSavedWatchJWT {
            return .yellow
        }
        return .orange
    }
}

#Preview {
    ContentView()
}
