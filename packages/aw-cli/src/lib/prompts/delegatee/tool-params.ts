import prompts from 'prompts';
import type { AwTool } from '@lit-protocol/aw-tool';
import { AwCliError, AwCliErrorType } from '../../errors';

/**
 * Prompts the user to input parameters required for executing a tool.
 * The function iterates through the tool's parameter descriptions and collects user input for each parameter.
 * If a `pkpEthAddress` is provided, it is automatically used for the `pkpEthAddress` parameter without prompting.
 * After collecting all parameters, the function validates them using the tool's validation logic.
 *
 * @template T - A generic type representing the structure of the tool's parameters.
 * @param tool - The `AwTool` object for which parameters are being collected.
 * @param pkpEthAddress - Optional. The Ethereum address of the PKP (Programmable Key Pair) to be used as the `pkpEthAddress` parameter.
 * @returns A promise that resolves to an object containing the collected and validated parameters.
 * @throws {AwCliError} If the user cancels input for any parameter, an error of type `DELEGATEE_EXECUTE_TOOL_PARAMS_CANCELLED` is thrown.
 * @throws {AwCliError} If the collected parameters fail validation, an error of type `DELEGATEE_EXECUTE_TOOL_PARAMS_INVALID` is thrown, including details of the validation errors.
 */
export const promptToolParams = async <T extends Record<string, any>>(
  tool: AwTool<T, any>,
  pkpEthAddress?: string,
  options?: {
    missingParams?: Array<keyof T>;
    foundParams?: Partial<T>;
  }
) => {
  const params: Record<string, any> = { ...options?.foundParams };
  const paramsToPrompt = options?.missingParams
    ? Object.entries(tool.parameters.descriptions).filter(([paramName]) =>
        options.missingParams?.includes(paramName as keyof T)
      )
    : Object.entries(tool.parameters.descriptions);

  // Get each parameter from the user
  for (const [paramName, description] of paramsToPrompt) {
    if (paramName === 'pkpEthAddress' && pkpEthAddress !== undefined) {
      params.pkpEthAddress = pkpEthAddress;
      continue;
    }

    // Prompt the user for the parameter value.
    const { value } = await prompts({
      type: 'text', // Use a text input type for the parameter.
      name: 'value', // The name of the input.
      message: `Enter ${paramName} (${description}):`, // The message displayed to the user.
    });

    // If the user cancels the input, throw an error.
    if (value === undefined) {
      throw new AwCliError(
        AwCliErrorType.DELEGATEE_EXECUTE_TOOL_PARAMS_CANCELLED,
        'Parameter input cancelled'
      );
    }

    // Store the collected parameter value.
    params[paramName] = value;
  }

  // Validate the collected parameters using the tool's validation logic.
  const validationResult = tool.parameters.validate(params);
  if (validationResult !== true) {
    // If validation fails, format the errors and throw an error.
    const errors = validationResult
      .map(({ param, error }) => `${param}: ${error}`)
      .join('\n');
    throw new AwCliError(
      AwCliErrorType.DELEGATEE_EXECUTE_TOOL_PARAMS_INVALID,
      `Invalid parameters:\n${errors}`
    );
  }

  // Return the validated parameters.
  return params as T;
};
