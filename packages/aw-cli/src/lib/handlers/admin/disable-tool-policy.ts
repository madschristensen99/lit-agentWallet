import {
  Admin as AwAdmin,
  RegisteredToolWithPolicies,
  type PkpInfo,
} from '@lit-protocol/agent-wallet';
import prompts from 'prompts';

import { AwCliError, AwCliErrorType } from '../../errors';
import { logger } from '../../utils/logger';

const promptSelectToolToDisablePolicy = async (
  toolsWithPolicies: RegisteredToolWithPolicies[]
) => {
  // Filter out tools that don't have delegatees with enabled tool policies.
  const choices = toolsWithPolicies
    .filter((tool) =>
      Object.values(tool.delegateePolicies).some(
        (policy) => policy.policyEnabled
      )
    )
    .map((tool) => ({
      title: `${tool.name} (${tool.ipfsCid})`,
      value: tool,
    }));

  // Prompt the user to select a tool.
  const { tool } = await prompts({
    type: 'select',
    name: 'tool',
    message: 'Select a tool to disable policy:',
    choices,
  });

  // Throw an error if the user cancels the selection.
  if (!tool) {
    throw new AwCliError(
      AwCliErrorType.ADMIN_DISABLE_TOOL_POLICY_CANCELLED,
      'Tool policy disabling cancelled.'
    );
  }

  // Return the selected tool.
  return tool as RegisteredToolWithPolicies;
};

const promptSelectToolDelegateeForPolicy = async (delegatees: string[]) => {
  if (delegatees.length === 0) {
    throw new AwCliError(
      AwCliErrorType.ADMIN_SET_TOOL_POLICY_NO_DELEGATEES,
      'No delegatees with tool policy found.'
    );
  }

  // Map the delegatees to a list of choices for the prompts library.
  const choices = delegatees.map((delegatee) => ({
    title: delegatee,
    value: delegatee,
  }));

  // Prompt the user to select a delegatee.
  const { delegatee } = await prompts({
    type: 'select',
    name: 'delegatee',
    message: 'Select a delegatee to disable policy:',
    choices,
  });

  // Throw an error if the user cancels the selection.
  if (!delegatee) {
    throw new AwCliError(
      AwCliErrorType.ADMIN_DISABLE_TOOL_POLICY_CANCELLED,
      'Disable tool policy cancelled.'
    );
  }

  // Return the selected delegatee.
  return delegatee;
};

export const handleDisableToolPolicy = async (
  awAdmin: AwAdmin,
  pkp: PkpInfo
) => {
  try {
    const registeredTools = await awAdmin.getRegisteredToolsAndDelegateesForPkp(
      pkp.info.tokenId
    );

    if (
      registeredTools === null ||
      Object.keys(registeredTools.toolsWithPolicies).length === 0
    ) {
      throw new AwCliError(
        AwCliErrorType.ADMIN_DISABLE_TOOL_POLICY_NO_TOOLS_FOUND,
        'No permitted tools with policies found.'
      );
    }

    const toolsWithEnabledPolicies = Object.values(
      registeredTools.toolsWithPolicies
    ).filter((tool) =>
      Object.values(tool.delegateePolicies).some(
        (policy) => policy.policyEnabled
      )
    );

    if (toolsWithEnabledPolicies.length === 0) {
      throw new AwCliError(
        AwCliErrorType.ADMIN_DISABLE_TOOL_POLICY_NO_ENABLED_TOOLS,
        'No tools with enabled policies found.'
      );
    }

    // Prompt the user to select a tool and retrieve its policy.
    const selectedTool = await promptSelectToolToDisablePolicy(
      toolsWithEnabledPolicies
    );

    const delegateesWithEnabledPolicies = selectedTool.delegatees.filter(
      (delegatee) => selectedTool.delegateePolicies[delegatee]?.policyEnabled
    );

    if (delegateesWithEnabledPolicies.length === 0) {
      throw new AwCliError(
        AwCliErrorType.ADMIN_DISABLE_TOOL_POLICY_NO_ENABLED_TOOLS,
        'No delegatees with enabled policies found for the selected tool.'
      );
    }

    await awAdmin.disableToolPolicyForDelegatee(
      pkp.info.tokenId,
      selectedTool.ipfsCid,
      await promptSelectToolDelegateeForPolicy(delegateesWithEnabledPolicies)
    );

    logger.success('Tool policy disabled successfully.');
  } catch (error) {
    // Handle specific errors related to tool policy retrieval.
    if (error instanceof AwCliError) {
      if (
        error.type === AwCliErrorType.ADMIN_DISABLE_TOOL_POLICY_NO_TOOLS_FOUND
      ) {
        // Log an error message if no permitted tools are found.
        logger.error('No permitted tools with policies found.');
        return;
      }

      if (error.type === AwCliErrorType.ADMIN_DISABLE_TOOL_POLICY_CANCELLED) {
        // Log an error message if the user cancels the operation.
        logger.error('Tool policy disabling cancelled.');
        return;
      }

      if (
        error.type === AwCliErrorType.ADMIN_DISABLE_TOOL_POLICY_NO_ENABLED_TOOLS
      ) {
        logger.error('No tools with enabled policies found.');
        return;
      }

      if (error.type === AwCliErrorType.ADMIN_SET_TOOL_POLICY_NO_DELEGATEES) {
        logger.error('No delegatees with enabled policies found.');
        return;
      }
    }

    // Re-throw any other errors to be handled by the caller.
    throw error;
  }
};
