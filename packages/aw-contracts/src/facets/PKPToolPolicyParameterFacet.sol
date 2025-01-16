// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PKPToolPolicyBase.sol";
import "../libraries/PKPToolPolicyStorage.sol";
import "../libraries/PKPToolPolicyErrors.sol";
import "../libraries/PKPToolPolicyEvents.sol";

contract PKPToolPolicyParameterFacet is PKPToolPolicyBase {
    using PKPToolPolicyStorage for PKPToolPolicyStorage.Layout;

    /// @notice Get all registered parameter names for a specific tool and delegatee
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCid The IPFS CID of the tool
    /// @param delegatee The delegatee address to get parameters for
    /// @return parameterNames Array of registered parameter names
    function getToolPolicyParameterNamesForDelegatee(
        uint256 pkpTokenId,
        string calldata toolIpfsCid,
        address delegatee
    ) external view returns (string[] memory) {
        if (delegatee == address(0)) revert PKPToolPolicyErrors.InvalidDelegatee();
        _verifyToolRegistered(pkpTokenId, toolIpfsCid);
        PKPToolPolicyStorage.Layout storage l = PKPToolPolicyStorage.layout();
        PKPToolPolicyStorage.PKPData storage pkpData = l.pkpStore[pkpTokenId];
        PKPToolPolicyStorage.ToolInfo storage toolInfo = pkpData.toolMap[toolIpfsCid];
        return toolInfo.policyParameterNames[delegatee];
    }

    /// @notice Get a specific parameter value for a delegatee
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCid The IPFS CID of the tool
    /// @param delegatee The delegatee address to get the parameter for
    /// @param parameterName The name of the parameter to get
    /// @return parameterValue The value of the parameter
    function getToolPolicyParameterForDelegatee(
        uint256 pkpTokenId,
        string calldata toolIpfsCid,
        address delegatee,
        string calldata parameterName
    ) external view returns (bytes memory) {
        if (delegatee == address(0)) revert PKPToolPolicyErrors.InvalidDelegatee();
        _verifyToolRegistered(pkpTokenId, toolIpfsCid);
        PKPToolPolicyStorage.Layout storage l = PKPToolPolicyStorage.layout();
        PKPToolPolicyStorage.PKPData storage pkpData = l.pkpStore[pkpTokenId];
        PKPToolPolicyStorage.ToolInfo storage toolInfo = pkpData.toolMap[toolIpfsCid];
        return toolInfo.policyParameters[delegatee][parameterName];
    }

    /// @notice Set a parameter for a specific tool and delegatee
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCid The IPFS CID of the tool
    /// @param delegatee The delegatee address to set the parameter for
    /// @param parameterName The name of the parameter to set
    /// @param parameterValue The value to set for the parameter
    function setToolPolicyParameterForDelegatee(
        uint256 pkpTokenId,
        string calldata toolIpfsCid,
        address delegatee,
        string calldata parameterName,
        bytes calldata parameterValue
    ) public onlyPKPOwner(pkpTokenId) {
        if (delegatee == address(0)) revert PKPToolPolicyErrors.InvalidDelegatee();
        _verifyToolRegistered(pkpTokenId, toolIpfsCid);
        PKPToolPolicyStorage.Layout storage l = PKPToolPolicyStorage.layout();
        PKPToolPolicyStorage.PKPData storage pkpData = l.pkpStore[pkpTokenId];
        PKPToolPolicyStorage.ToolInfo storage toolInfo = pkpData.toolMap[toolIpfsCid];

        // Register parameter name if not already registered
        string[] storage parameterNames = toolInfo.policyParameterNames[delegatee];
        bool found;
        for (uint256 i; i < parameterNames.length;) {
            if (keccak256(bytes(parameterNames[i])) == keccak256(bytes(parameterName))) {
                found = true;
                break;
            }
            unchecked { ++i; }
        }
        if (!found) {
            parameterNames.push(parameterName);
        }

        // Set parameter value
        toolInfo.policyParameters[delegatee][parameterName] = parameterValue;

        emit PKPToolPolicyEvents.PolicyParameterSet(
            pkpTokenId,
            toolIpfsCid,
            delegatee,
            parameterName,
            parameterValue
        );
    }

    /// @notice Remove a parameter for a specific tool and delegatee
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCid The IPFS CID of the tool
    /// @param delegatee The delegatee address to remove the parameter for
    /// @param parameterName The name of the parameter to remove
    function removeToolPolicyParameterForDelegatee(
        uint256 pkpTokenId,
        string calldata toolIpfsCid,
        address delegatee,
        string calldata parameterName
    ) public onlyPKPOwner(pkpTokenId) {
        if (delegatee == address(0)) revert PKPToolPolicyErrors.InvalidDelegatee();
        _verifyToolRegistered(pkpTokenId, toolIpfsCid);
        PKPToolPolicyStorage.Layout storage l = PKPToolPolicyStorage.layout();
        PKPToolPolicyStorage.PKPData storage pkpData = l.pkpStore[pkpTokenId];
        PKPToolPolicyStorage.ToolInfo storage toolInfo = pkpData.toolMap[toolIpfsCid];

        // Remove parameter name
        string[] storage parameterNames = toolInfo.policyParameterNames[delegatee];
        for (uint256 i; i < parameterNames.length;) {
            if (keccak256(bytes(parameterNames[i])) == keccak256(bytes(parameterName))) {
                // Move last element to this position (unless we're already at the end)
                if (i != parameterNames.length - 1) {
                    parameterNames[i] = parameterNames[parameterNames.length - 1];
                }
                parameterNames.pop();
                break;
            }
            unchecked { ++i; }
        }

        // Delete parameter value
        delete toolInfo.policyParameters[delegatee][parameterName];

        emit PKPToolPolicyEvents.PolicyParameterRemoved(
            pkpTokenId,
            toolIpfsCid,
            delegatee,
            parameterName
        );
    }

    /// @notice Set multiple parameters for a specific tool and delegatee
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCid The IPFS CID of the tool
    /// @param delegatee The delegatee address to set parameters for
    /// @param parameterNames Array of parameter names to set
    /// @param parameterValues Array of parameter values to set
    function batchSetToolPolicyParametersForDelegatee(
        uint256 pkpTokenId,
        string calldata toolIpfsCid,
        address delegatee,
        string[] calldata parameterNames,
        bytes[] calldata parameterValues
    ) external onlyPKPOwner(pkpTokenId) {
        if (parameterNames.length != parameterValues.length) {
            revert PKPToolPolicyErrors.ArrayLengthMismatch();
        }

        for (uint256 i; i < parameterNames.length;) {
            setToolPolicyParameterForDelegatee(
                pkpTokenId,
                toolIpfsCid,
                delegatee,
                parameterNames[i],
                parameterValues[i]
            );
            unchecked { ++i; }
        }
    }

    /// @notice Remove multiple parameters for a specific tool and delegatee
    /// @param pkpTokenId The PKP token ID
    /// @param toolIpfsCid The IPFS CID of the tool
    /// @param delegatee The delegatee address to remove parameters for
    /// @param parameterNames Array of parameter names to remove
    function batchRemoveToolPolicyParametersForDelegatee(
        uint256 pkpTokenId,
        string calldata toolIpfsCid,
        address delegatee,
        string[] calldata parameterNames
    ) external onlyPKPOwner(pkpTokenId) {
        for (uint256 i; i < parameterNames.length;) {
            removeToolPolicyParameterForDelegatee(
                pkpTokenId,
                toolIpfsCid,
                delegatee,
                parameterNames[i]
            );
            unchecked { ++i; }
        }
    }
} 