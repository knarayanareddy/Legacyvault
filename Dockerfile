  for (let start = 0; start < beneficiaries.length; start += args.batchSize) {
    const end = Math.min(start + args.batchSize, beneficiaries.length);
    const slice = beneficiaries.slice(start, end);

    const remaining = [];
    for (const b of slice) {
      const [be] = beneficiaryEntryPda(args.program.programId, args.vault, b);
      const ata = getAssociatedTokenAddressSync(args.mint, b);
      remaining.push({ pubkey: be, isSigner: false, isWritable: false });
      remaining.push({ pubkey: b, isSigner: false, isWritable: false });
      remaining.push({ pubkey: ata, isSigner: false, isWritable: true });
    }

    const ix = await args.program.methods
