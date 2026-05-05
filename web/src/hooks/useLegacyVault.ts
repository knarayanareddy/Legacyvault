import { useMemo } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import idl from '../idl/legacyvault.json';
import { PublicKey } from '@solana/web3.js';

export function useLegacyVault() {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();

    const program = useMemo(() => {
        if (!wallet) return null;

        const provider = new AnchorProvider(connection, wallet, {
            preflightCommitment: 'processed',
        });

        return new Program(idl as Idl, provider);
    }, [connection, wallet]);

    return {
        program,
        wallet,
        connection,
    };
}
