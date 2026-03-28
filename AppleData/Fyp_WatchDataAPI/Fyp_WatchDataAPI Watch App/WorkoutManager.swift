import Foundation
import HealthKit
import SwiftUI
import Combine
import WatchKit

class WorkoutManager: NSObject, ObservableObject {
    @Published var statusMessage: String = "Ready"
    @Published var isAuthorized: Bool = false
    @Published var heartRate: Double = 0
    @Published var activeEnergy: Double = 0
    @Published var isBackendPaired: Bool = false
    
    let healthStore = HKHealthStore()
    private let backendBaseURLKey = "watch_backend_base_url"
    private let watchJWTKey = "watch_jwt"
    private let watchDeviceUUIDKey = "watch_device_uuid"
    
    var workoutSession: HKWorkoutSession?
    var builder: HKLiveWorkoutBuilder?

    override init() {
        super.init()
        isBackendPaired = !(currentWatchJWT?.isEmpty ?? true)
    }

    var backendBaseURL: String {
        get {
            UserDefaults.standard.string(forKey: backendBaseURLKey) ?? "http://localhost:3000"
        }
        set {
            UserDefaults.standard.set(newValue, forKey: backendBaseURLKey)
        }
    }

    var currentWatchJWT: String? {
        UserDefaults.standard.string(forKey: watchJWTKey)
    }

    var deviceUUID: String {
        if let existing = UserDefaults.standard.string(forKey: watchDeviceUUIDKey), !existing.isEmpty {
            return existing
        }
        let uuid = UUID().uuidString
        UserDefaults.standard.set(uuid, forKey: watchDeviceUUIDKey)
        return uuid
    }

    func pairWithCode(_ code: String, completion: @escaping (Bool, String) -> Void) {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            completion(false, "Pairing code is required")
            return
        }

        guard let url = URL(string: "\(backendBaseURL)/api/watch/pair-confirm") else {
            completion(false, "Invalid backend URL")
            return
        }

        let payload: [String: Any] = [
            "pairing_code": trimmed,
            "device_uuid": deviceUUID,
            "device_model": WKInterfaceDevice.current().model,
            "os_version": WKInterfaceDevice.current().systemVersion,
            "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        URLSession.shared.dataTask(with: request) { [weak self] data, _, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(false, "Pairing failed: \(error.localizedDescription)")
                    return
                }

                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    completion(false, "Invalid pairing response")
                    return
                }

                if let success = json["success"] as? Bool, success,
                   let token = json["token"] as? String {
                    UserDefaults.standard.set(token, forKey: self?.watchJWTKey ?? "watch_jwt")
                    self?.isBackendPaired = true
                    self?.statusMessage = "Paired with backend"
                    completion(true, "Pairing successful")
                    return
                }

                let errorMessage = json["error"] as? String ?? "Pairing failed"
                completion(false, errorMessage)
            }
        }.resume()
    }

    func sendInSessionFeedback(exerciseType: String, setCount: Int, restDuration: Int, completion: @escaping (Bool, String) -> Void) {
        let payload: [String: Any] = [
            "heart_rate": Int(heartRate),
            "current_speed": 0,
            "exercise_type": exerciseType,
            "set_count": setCount,
            "rest_duration": max(restDuration, 0)
        ]

        sendAuthenticatedWatchRequest(path: "/api/watch/in-session-feedback", payload: payload) { success, json, errorMessage in
            DispatchQueue.main.async {
                if !success {
                    completion(false, errorMessage ?? "Failed to fetch feedback")
                    return
                }

                let suggestion = (json?["suggestion"] as? String) ?? "No suggestion returned"
                completion(true, suggestion)
            }
        }
    }

    func sendSessionEnd(exerciseType: String, setCount: Int, restDuration: Int, completion: @escaping (Bool, String) -> Void) {
        let payload: [String: Any] = [
            "heart_rate": Int(heartRate),
            "current_speed": 0,
            "exercise_type": exerciseType,
            "set_count": setCount,
            "rest_duration": max(restDuration, 0)
        ]

        sendAuthenticatedWatchRequest(path: "/api/watch/session-end", payload: payload) { success, json, errorMessage in
            DispatchQueue.main.async {
                if !success {
                    completion(false, errorMessage ?? "Failed to save session")
                    return
                }

                let message = (json?["message"] as? String) ?? "Session saved"
                completion(true, message)
            }
        }
    }

    private func sendAuthenticatedWatchRequest(path: String, payload: [String: Any], completion: @escaping (Bool, [String: Any]?, String?) -> Void) {
        guard let token = currentWatchJWT, !token.isEmpty else {
            completion(false, nil, "Watch not paired. Pair first.")
            return
        }

        guard let url = URL(string: "\(backendBaseURL)\(path)") else {
            completion(false, nil, "Invalid backend URL")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 20
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(false, nil, error.localizedDescription)
                return
            }

            guard let http = response as? HTTPURLResponse else {
                completion(false, nil, "No HTTP response")
                return
            }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                completion(false, nil, "Invalid server response")
                return
            }

            guard (200...299).contains(http.statusCode) else {
                let errorMessage = json["error"] as? String
                    ?? (json["message"] as? String)
                    ?? ((json["errors"] as? [String])?.joined(separator: "; "))
                    ?? "Request failed with status \(http.statusCode)"
                completion(false, json, errorMessage)
                return
            }

            completion(true, json, nil)
        }.resume()
    }
    
    // MARK: - Request Authorization (both READ and WRITE)
    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else {
            statusMessage = "Health data not available"
            return
        }
        
        // Types to WRITE (share)
        let typesToShare: Set<HKSampleType> = [
            HKObjectType.workoutType()
        ]
        
        // Types to READ
        let typesToRead: Set<HKObjectType> = [
            HKQuantityType.quantityType(forIdentifier: .heartRate)!,
            HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.activitySummaryType()
        ]
        
        statusMessage = "Requesting authorization..."
        
        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { [weak self] success, error in
            DispatchQueue.main.async {
                if let error = error {
                    self?.statusMessage = "Error: \(error.localizedDescription)"
                    self?.isAuthorized = false
                } else if success {
                    self?.statusMessage = "✓ HealthKit Authorized"
                    self?.isAuthorized = true
                } else {
                    self?.statusMessage = "Authorization denied"
                    self?.isAuthorized = false
                }
            }
        }
    }
    
    // MARK: - Start Workout Session
    func startWorkout() {
        guard isAuthorized else {
            statusMessage = "Not authorized. Request permission first."
            return
        }
        
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .running
        configuration.locationType = .outdoor
        
        do {
            workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            builder = workoutSession?.associatedWorkoutBuilder()
            
            builder?.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )
            
            workoutSession?.delegate = self
            builder?.delegate = self
            
            workoutSession?.startActivity(with: Date())
            builder?.beginCollection(withStart: Date()) { [weak self] success, error in
                guard success else {
                    self?.statusMessage = "Failed to start collection"
                    return
                }
                DispatchQueue.main.async {
                    self?.statusMessage = "Workout in progress..."
                }
            }
        } catch {
            statusMessage = "Failed to start workout: \(error)"
        }
    }
    
    // MARK: - End Workout Session
    func endWorkout() {
        guard let session = workoutSession, let builder = builder else {
            return
        }
        
        session.stopActivity(with: Date())
        
        builder.endCollection(withEnd: Date()) { [weak self] success, error in
            guard success else {
                self?.statusMessage = "Failed to end collection"
                return
            }
            
            builder.finishWorkout { [weak self] workout, error in
                guard let workout = workout else {
                    self?.statusMessage = "Failed to save workout"
                    return
                }
                
                session.end()
                DispatchQueue.main.async {
                    self?.statusMessage = "✓ Workout saved!"
                }
            }
        }
    }
}

// MARK: - HKWorkoutSessionDelegate
extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession,
                      didChangeTo toState: HKWorkoutSessionState,
                      from fromState: HKWorkoutSessionState,
                      date: Date) {
        DispatchQueue.main.async {
            switch toState {
            case .running:
                break
            case .paused:
                self.statusMessage = "Workout paused"
            case .stopped:
                self.statusMessage = "Workout stopped"
            case .ended:
                self.statusMessage = "Workout ended"
            default:
                self.statusMessage = "Unknown state"
            }
        }
    }
    
    func workoutSession(_ workoutSession: HKWorkoutSession,
                      didFailWithError error: Error) {
        DispatchQueue.main.async {
            self.statusMessage = "Workout error: \(error.localizedDescription)"
        }
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate
extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                      didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }
            
            let statistics = workoutBuilder.statistics(for: quantityType)
            
            DispatchQueue.main.async {
                switch quantityType {
                case HKQuantityType.quantityType(forIdentifier: .heartRate):
                    self.heartRate = statistics?.mostRecentQuantity()?.doubleValue(for: HKUnit.count().unitDivided(by: .minute())) ?? 0
                case HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned):
                    self.activeEnergy = statistics?.sumQuantity()?.doubleValue(for: HKUnit.kilocalorie()) ?? 0
                default:
                    break
                }
            }
        }
    }
    
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {
        // Handle workout events if needed
    }
}
