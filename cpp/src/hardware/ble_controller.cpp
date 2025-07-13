#include "hardware/ble_controller.h"
#include <QDebug>
#include <QByteArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QBluetoothUuid>

BLEController::BLEController(QObject *parent)
    : QObject(parent)
    , discoveryAgent(std::make_unique<QBluetoothDeviceDiscoveryAgent>(this)) {
    
    // Connect discovery agent signals using modern Qt syntax
    connect(discoveryAgent.get(), &QBluetoothDeviceDiscoveryAgent::deviceDiscovered,
            this, &BLEController::onDeviceDiscovered);
    connect(discoveryAgent.get(), qOverload<QBluetoothDeviceDiscoveryAgent::Error>(&QBluetoothDeviceDiscoveryAgent::errorOccurred),
            this, &BLEController::onDiscoveryError);
    connect(discoveryAgent.get(), &QBluetoothDeviceDiscoveryAgent::finished,
            this, &BLEController::onDiscoveryFinished);
}

BLEController::~BLEController() {
    if (connectionState != ConnectionState::Disconnected) {
        disconnectFromHub();
    }
}

void BLEController::setLogCallback(std::function<void(const QString&, const QString&)> callback) {
    logCallback = std::move(callback);
}

void BLEController::scanForHub() {
    if (scanning) {
        logMessage("Already scanning for hubs", "warning");
        return;
    }
    
    scanning = true;
    logMessage("Scanning for Pybricks hubs...", "info");
    
    discoveryAgent->setLowEnergyDiscoveryTimeout(10000);
    discoveryAgent->start(QBluetoothDeviceDiscoveryAgent::LowEnergyMethod);
}

void BLEController::connectToHub() {
    if (targetDevice.isValid()) {
        connectToDevice(targetDevice);
    } else {
        logMessage("No target device found. Please scan first.");
    }
}

void BLEController::connectToDevice(const QBluetoothDeviceInfo &deviceInfo) {
    if (connectionState != ConnectionState::Disconnected) {
        return;
    }
    
    logMessage("Connecting to device: " + deviceInfo.name());
    connectionState = ConnectionState::Connecting;
    emit connectionStateChanged(connectionState);
    
    targetDevice = deviceInfo;
    controller.reset(QLowEnergyController::createCentral(targetDevice, this));
    
    // Connect controller signals using modern Qt syntax
    connect(controller.get(), &QLowEnergyController::connected,
            this, &BLEController::onControllerConnected);
    connect(controller.get(), &QLowEnergyController::disconnected,
            this, &BLEController::onControllerDisconnected);
    connect(controller.get(), qOverload<QLowEnergyController::Error>(&QLowEnergyController::errorOccurred),
            this, &BLEController::onControllerError);
    connect(controller.get(), &QLowEnergyController::serviceDiscovered,
            this, &BLEController::onServiceDiscovered);
    connect(controller.get(), &QLowEnergyController::discoveryFinished,
            this, &BLEController::onServiceDiscoveryFinished);
    
    controller->connectToDevice();
}

void BLEController::disconnectFromHub() {
    if (connectionState == ConnectionState::Disconnected) {
        return;
    }
    
    logMessage("Disconnecting from hub...", "info");
    
    if (controller) {
        controller->disconnectFromDevice();
    }
    
    connectionState = ConnectionState::Disconnected;
    emit connectionStateChanged(connectionState);
}

void BLEController::sendCommand(const QVariantHash& command) {
    if (connectionState != ConnectionState::Connected || !service || !commandCharacteristic.isValid()) {
        logMessage("Not connected to hub or service not ready", "error");
        return;
    }
    
    QJsonObject jsonCmd;
    for (auto it = command.begin(); it != command.end(); ++it) {
        const QVariant& value = it.value();
        if (value.typeId() == QMetaType::QString) {
            jsonCmd[it.key()] = value.toString();
        } else if (value.typeId() == QMetaType::Int) {
            jsonCmd[it.key()] = value.toInt();
        } else if (value.typeId() == QMetaType::Double) {
            jsonCmd[it.key()] = value.toDouble();
        } else if (value.typeId() == QMetaType::Bool) {
            jsonCmd[it.key()] = value.toBool();
        }
    }
    
    QJsonDocument doc(jsonCmd);
    QByteArray data = doc.toJson(QJsonDocument::Compact);
    
    service->writeCharacteristic(commandCharacteristic, data);
    emit commandSent(command);
}

void BLEController::onDeviceDiscovered(const QBluetoothDeviceInfo& device) {
    if (device.name().startsWith(HUB_NAME_PREFIX)) {
        logMessage("Found Pybricks hub: " + device.name(), "info");
        targetDevice = device;
        emit hubFound(device.name());
    }
}

void BLEController::onDiscoveryFinished() {
    scanning = false;
    
    logMessage("Device discovery finished");
    
    // Look for SPIKE Prime hub
    for (const auto &device : discoveryAgent->discoveredDevices()) {
        if (device.name().contains(HUB_NAME_PREFIX)) {
            targetDevice = device;
            emit hubFound(device.name());
            logMessage("Found SPIKE Prime hub: " + device.name());
            return;
        }
    }
    
    logMessage("No SPIKE Prime hub found");
}

void BLEController::onDiscoveryError(QBluetoothDeviceDiscoveryAgent::Error error) {
    scanning = false;
    
    QString errorStr;
    switch (error) {
        case QBluetoothDeviceDiscoveryAgent::PoweredOffError:
            errorStr = "Bluetooth is powered off";
            break;
        case QBluetoothDeviceDiscoveryAgent::InputOutputError:
            errorStr = "Input/Output error during scan";
            break;
        case QBluetoothDeviceDiscoveryAgent::InvalidBluetoothAdapterError:
            errorStr = "Invalid Bluetooth adapter";
            break;
        case QBluetoothDeviceDiscoveryAgent::UnsupportedPlatformError:
            errorStr = "Unsupported platform";
            break;
        case QBluetoothDeviceDiscoveryAgent::UnsupportedDiscoveryMethod:
            errorStr = "Unsupported discovery method";
            break;
        default:
            errorStr = "Unknown scan error";
            break;
    }
    
    logMessage("Scan error: " + errorStr, "error");
    emit errorOccurred(errorStr);
}

void BLEController::onControllerConnected() {
    logMessage("Connected to hub. Discovering services...", "info");
    controller->discoverServices();
}

void BLEController::onControllerDisconnected() {
    logMessage("Disconnected from hub", "info");
    connectionState = ConnectionState::Disconnected;
    emit connectionStateChanged(connectionState);
}

void BLEController::onControllerError(QLowEnergyController::Error error) {
    QString errorStr;
    switch (error) {
        case QLowEnergyController::UnknownError:
            errorStr = "Unknown controller error";
            break;
        case QLowEnergyController::UnknownRemoteDeviceError:
            errorStr = "Unknown remote device error";
            break;
        case QLowEnergyController::NetworkError:
            errorStr = "Network error";
            break;
        case QLowEnergyController::InvalidBluetoothAdapterError:
            errorStr = "Invalid Bluetooth adapter";
            break;
        case QLowEnergyController::ConnectionError:
            errorStr = "Connection error";
            break;
        case QLowEnergyController::AdvertisingError:
            errorStr = "Advertising error";
            break;
        case QLowEnergyController::RemoteHostClosedError:
            errorStr = "Remote host closed connection";
            break;
        case QLowEnergyController::AuthorizationError:
            errorStr = "Authorization error";
            break;
        default:
            errorStr = "Controller error: " + QString::number(static_cast<int>(error));
            break;
    }
    
    logMessage("Controller error: " + errorStr, "error");
    emit errorOccurred(errorStr);
}

void BLEController::onServiceDiscovered(const QBluetoothUuid& serviceUuid) {
    logMessage("Service discovered: " + serviceUuid.toString(), "debug");
}

void BLEController::onServiceDiscoveryFinished() {
    logMessage("Service discovery finished", "info");
    connectToService();
}

void BLEController::onServiceStateChanged(QLowEnergyService::ServiceState state) {
    auto service = qobject_cast<QLowEnergyService*>(sender());
    if (!service) return;
    
    logMessage(QString("Service state changed: %1").arg(static_cast<int>(state)));
    
    switch (state) {
        case QLowEnergyService::RemoteServiceDiscovered:
            logMessage("Service discovered, looking for characteristics...");
            // Look for the main command characteristic
            for (const auto &characteristic : service->characteristics()) {
                if (characteristic.uuid() == QBluetoothUuid(PYBRICKS_COMMAND_CHARACTERISTIC_UUID)) {
                    commandCharacteristic = characteristic;
                    
                    // Check if characteristic supports notifications
                    if (characteristic.properties() & QLowEnergyCharacteristic::Notify) {
                        // Enable notifications by writing to the Client Characteristic Configuration descriptor
                        auto descriptor = characteristic.descriptor(QBluetoothUuid::DescriptorType::ClientCharacteristicConfiguration);
                        if (descriptor.isValid()) {
                            service->writeDescriptor(descriptor, QByteArray::fromHex("0100"));
                        }
                    }
                    
                    connectionState = ConnectionState::Connected;
                    emit connectionStateChanged(connectionState);
                    logMessage("Successfully connected to SPIKE Prime hub!");
                    return;
                }
            }
            logMessage("Warning: Command characteristic not found");
            break;
            
        case QLowEnergyService::RemoteService:
            logMessage("Service discovery required");
            service->discoverDetails();
            break;
            
        case QLowEnergyService::RemoteServiceDiscovering:
            logMessage("Discovering service details...");
            break;
            
        default:
            break;
    }
}

void BLEController::onCharacteristicRead(const QLowEnergyCharacteristic& characteristic, const QByteArray& value) {
    Q_UNUSED(characteristic)
    handleResponse(value);
}

void BLEController::onCharacteristicWritten(const QLowEnergyCharacteristic& characteristic, const QByteArray& value) {
    Q_UNUSED(characteristic)
    Q_UNUSED(value)
    logMessage("Command sent successfully", "debug");
}

void BLEController::onCharacteristicChanged(const QLowEnergyCharacteristic& characteristic, const QByteArray& value) {
    Q_UNUSED(characteristic)
    handleResponse(value);
}

void BLEController::onDescriptorWritten(const QLowEnergyDescriptor& descriptor, const QByteArray& value) {
    Q_UNUSED(descriptor)
    Q_UNUSED(value)
    logMessage("Descriptor written successfully", "debug");
}

void BLEController::logMessage(const QString& message, const QString& level) {
    if (logCallback) {
        logCallback(message, level);
    }
}

void BLEController::connectToService() {
    auto services = controller->services();
    
    for (const auto& serviceUuid : services) {
        service = std::unique_ptr<QLowEnergyService>(controller->createServiceObject(serviceUuid));
        
        if (service) {
            connect(service.get(), &QLowEnergyService::stateChanged,
                    this, &BLEController::onServiceStateChanged);
            connect(service.get(), &QLowEnergyService::characteristicRead,
                    this, &BLEController::onCharacteristicRead);
            connect(service.get(), &QLowEnergyService::characteristicWritten,
                    this, &BLEController::onCharacteristicWritten);
            connect(service.get(), &QLowEnergyService::characteristicChanged,
                    this, &BLEController::onCharacteristicChanged);
            connect(service.get(), &QLowEnergyService::descriptorWritten,
                    this, &BLEController::onDescriptorWritten);
            
            service->discoverDetails();
            break;
        }
    }
    
    if (!service) {
        logMessage("No suitable service found", "error");
        emit errorOccurred("No suitable service found");
    }
}

void BLEController::handleResponse(const QByteArray& data) {
    QString response = QString::fromUtf8(data);
    logMessage("Received response: " + response, "debug");
    
    if (response.contains("rdy")) {
        logMessage("Hub ready for commands", "info");
    } else if (response.contains("DRIVE_OK")) {
        logMessage("Drive command executed", "debug");
    } else if (response.contains("ARM_OK")) {
        logMessage("Arm command executed", "debug");
    } else if (response.contains("CONFIG_OK")) {
        logMessage("Configuration updated", "info");
    } else if (response.contains("ERROR")) {
        logMessage("Hub reported error", "error");
    }
} 