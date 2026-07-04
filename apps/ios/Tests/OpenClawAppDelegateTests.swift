import Foundation
import Testing
@testable import Zavorth

@Suite(.serialized) struct ZavorthAppDelegateTests {
    @Test @MainActor func `resolves registry model before view task assigns delegate model`() {
        let registryModel = NodeAppModel()
        ZavorthAppModelRegistry.appModel = registryModel
        defer { ZavorthAppModelRegistry.appModel = nil }

        let delegate = ZavorthAppDelegate()

        #expect(delegate._test_resolvedAppModel() === registryModel)
    }

    @Test @MainActor func `prefers explicit delegate model over registry fallback`() {
        let registryModel = NodeAppModel()
        let explicitModel = NodeAppModel()
        ZavorthAppModelRegistry.appModel = registryModel
        defer { ZavorthAppModelRegistry.appModel = nil }

        let delegate = ZavorthAppDelegate()
        delegate.appModel = explicitModel

        #expect(delegate._test_resolvedAppModel() === explicitModel)
    }

    @Test @MainActor func `derives background refresh task identifier from app bundle identifier`() {
        let delegate = ZavorthAppDelegate()
        let bundleIdentifier = Bundle.main.bundleIdentifier ?? "dev.zavorth.companion.tests"

        #expect(delegate._test_wakeRefreshTaskIdentifier() == "\(bundleIdentifier).bgrefresh")
    }
}
