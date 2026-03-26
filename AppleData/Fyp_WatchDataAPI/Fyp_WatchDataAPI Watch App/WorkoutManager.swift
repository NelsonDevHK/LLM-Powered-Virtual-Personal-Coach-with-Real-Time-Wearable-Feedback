import Foundation
import HealthKit
import SwiftUI
import Combine

class WorkoutManager: NSObject, ObservableObject {
    @Published var statusMessage: String = "Ready"
    @Published var isAuthorized: Bool = false
    @Published var heartRate: Double = 0
    @Published var activeEnergy: Double = 0
    
    let healthStore = HKHealthStore()
    
    var workoutSession: HKWorkoutSession?
    var builder: HKLiveWorkoutBuilder?
    
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
