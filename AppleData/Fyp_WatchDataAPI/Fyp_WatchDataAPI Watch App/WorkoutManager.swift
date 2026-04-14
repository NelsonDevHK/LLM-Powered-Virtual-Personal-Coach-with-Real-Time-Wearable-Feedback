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
    @Published var isPairingInProgress: Bool = false
    
    let healthStore = HKHealthStore()
    private let backendBaseURLKey = "watch_backend_base_url"
    private let watchJWTKey = "watch_jwt"
    private let watchDeviceUUIDKey = "watch_device_uuid"

#if targetEnvironment(simulator)
    private let defaultBackendBaseURL = "http://localhost:3000"
#else
    private let defaultBackendBaseURL = ""
#endif
    
    var workoutSession: HKWorkoutSession?
    var builder: HKLiveWorkoutBuilder?
    
    // Track all heart rate readings during workout for average calculation
    private var workoutHeartRateReadings: [Double] = []

    override init() {
        super.init()
        // Do not assume paired from a stale local token at startup.
        isBackendPaired = false
    }

    var backendBaseURL: String {
        get {
            UserDefaults.standard.string(forKey: backendBaseURLKey) ?? defaultBackendBaseURL
        }
        set {
            UserDefaults.standard.set(newValue, forKey: backendBaseURLKey)
        }
    }

    private var normalizedBackendBaseURL: String {
        let trimmed = backendBaseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }

        if trimmed.contains("://") {
            return trimmed
        }

        let hasExplicitPort = trimmed.split(separator: ":").count > 1
        let hostAndPort = hasExplicitPort ? trimmed : "\(trimmed):3000"
        return "http://\(hostAndPort)"
    }

    private func isInvalidPhysicalWatchURL(_ baseURL: String) -> Bool {
#if targetEnvironment(simulator)
        return false
#else
        guard let host = URL(string: baseURL)?.host?.lowercased() else { return false }
        return host == "localhost" || host == "127.0.0.1"
#endif
    }

    private func validateBackendURLForCurrentDevice() -> String? {
        let normalized = normalizedBackendBaseURL
        if normalized.isEmpty {
            return "Set backend IP first (e.g. 192.168.x.x)."
        }
        if isInvalidPhysicalWatchURL(normalized) {
            return "On physical watch, localhost is invalid. Use Mac LAN IP (e.g. 192.168.x.x)."
        }
        guard URL(string: normalized) != nil else {
            return "Invalid backend IP or URL"
        }
        return nil
    }

    var currentWatchJWT: String? {
        UserDefaults.standard.string(forKey: watchJWTKey)
    }

    var hasSavedWatchJWT: Bool {
        !(currentWatchJWT?.isEmpty ?? true)
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

        if let urlError = validateBackendURLForCurrentDevice() {
            completion(false, urlError)
            return
        }

        guard let url = URL(string: "\(normalizedBackendBaseURL)/api/watch/pair-confirm") else {
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

        isPairingInProgress = true

        URLSession.shared.dataTask(with: request) { [weak self] data, _, error in
            DispatchQueue.main.async {
                self?.isPairingInProgress = false

                if let error = error {
                    self?.isBackendPaired = false
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

                self?.isBackendPaired = false
                let errorMessage = json["error"] as? String ?? "Pairing failed"
                completion(false, errorMessage)
            }
        }.resume()
    }

    func sendInSessionFeedback(exerciseType: String, setCount: Int, restDuration: Int, completion: @escaping (Bool, String) -> Void) {
        if let urlError = validateBackendURLForCurrentDevice() {
            completion(false, urlError)
            return
        }

        fetchRecentSleepMetrics { [weak self] sleepDuration, sleepQuality in
            var payload: [String: Any] = [
                "heart_rate": Int(self?.heartRate ?? 0),
                "heart_rate_history": self?.lastHeartRateReadings(limit: 10) ?? [],
                "current_speed": 0,
                "exercise_type": exerciseType,
                "set_count": setCount,
                "rest_duration": max(restDuration, 0)
            ]

            if let sleepDuration {
                payload["sleep_duration"] = sleepDuration
            }
            if let sleepQuality {
                payload["sleep_quality"] = sleepQuality
            }

            self?.sendAuthenticatedWatchRequest(path: "/api/watch/in-session-feedback", payload: payload) { success, json, errorMessage in
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
    }

    func sendSessionEnd(exerciseType: String, setCount: Int, restDuration: Int, completion: @escaping (Bool, String) -> Void) {
        if let urlError = validateBackendURLForCurrentDevice() {
            completion(false, urlError)
            return
        }

        fetchRecentSleepMetrics { [weak self] sleepDuration, sleepQuality in
            // Persist the workout-wide average HR for this set record.
            let avgHeartRate = self?.calculateAverageHeartRate() ?? 0

            var payload: [String: Any] = [
                "heart_rate": Int(avgHeartRate),
                "current_speed": 0,
                "exercise_type": exerciseType,
                "set_count": setCount,
                "rest_duration": max(restDuration, 0)
            ]

            if let sleepDuration {
                payload["sleep_duration"] = sleepDuration
            }
            if let sleepQuality {
                payload["sleep_quality"] = sleepQuality
            }

            self?.sendAuthenticatedWatchRequest(path: "/api/watch/set-end", payload: payload) { success, json, errorMessage in
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
    }

    private func sleepQualityScore(from durationMinutes: Int) -> Int {
        switch durationMinutes {
        case 480...:
            return 5
        case 420...:
            return 4
        case 360...:
            return 3
        case 300...:
            return 2
        default:
            return 1
        }
    }

    private func calculateAverageHeartRate() -> Double {
        guard !workoutHeartRateReadings.isEmpty else { return 0 }
        let sum = workoutHeartRateReadings.reduce(0, +)
        return sum / Double(workoutHeartRateReadings.count)
    }

    func clearWorkoutHeartRateReadings() {
        workoutHeartRateReadings.removeAll()
    }

    private func lastHeartRateReadings(limit: Int) -> [Double] {
        guard limit > 0, !workoutHeartRateReadings.isEmpty else { return [] }
        return Array(workoutHeartRateReadings.suffix(limit))
    }

    private func fetchRecentSleepMetrics(completion: @escaping (Int?, Int?) -> Void) {
        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            completion(nil, nil)
            return
        }

        let endDate = Date()
        let startDate = Calendar.current.date(byAdding: .day, value: -1, to: endDate) ?? endDate.addingTimeInterval(-24 * 60 * 60)
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: [.strictStartDate])
        let sortDescriptors = [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]

        let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: sortDescriptors) { _, samples, _ in
            guard let categorySamples = samples as? [HKCategorySample], !categorySamples.isEmpty else {
                completion(nil, nil)
                return
            }

            let asleepSamples = categorySamples.filter { sample in
                sample.value != HKCategoryValueSleepAnalysis.inBed.rawValue
                    && sample.value != HKCategoryValueSleepAnalysis.awake.rawValue
            }

            let totalMinutes = Int(
                asleepSamples.reduce(0.0) { partial, sample in
                    partial + sample.endDate.timeIntervalSince(sample.startDate) / 60.0
                }
                .rounded()
            )

            guard totalMinutes > 0 else {
                completion(nil, nil)
                return
            }

            completion(totalMinutes, self.sleepQualityScore(from: totalMinutes))
        }

        healthStore.execute(query)
    }

    private func sendAuthenticatedWatchRequest(path: String, payload: [String: Any], completion: @escaping (Bool, [String: Any]?, String?) -> Void) {
        guard let token = currentWatchJWT, !token.isEmpty else {
            completion(false, nil, "Watch not paired. Pair first.")
            return
        }

        guard let url = URL(string: "\(normalizedBackendBaseURL)\(path)") else {
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
                if http.statusCode == 401 || http.statusCode == 403 {
                    UserDefaults.standard.removeObject(forKey: self.watchJWTKey)
                    DispatchQueue.main.async {
                        self.isBackendPaired = false
                    }
                }

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
            HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!,
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
        
        // Reset HR readings for new workout
        workoutHeartRateReadings = []
        
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
                    let currentHR = statistics?.mostRecentQuantity()?.doubleValue(for: HKUnit.count().unitDivided(by: .minute())) ?? 0
                    self.heartRate = currentHR
                    // Append to readings array for averaging and trend context
                    if currentHR > 0 {
                        self.workoutHeartRateReadings.append(currentHR)
                    }
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
